import { CLIENT_SECRET } from './config'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

const AUTH_KEY = 'driveAuth'
const LEGACY_TOKEN_KEY = 'driveAccessToken' // implicit-flow token from older versions

// Refresh a little before actual expiry to absorb clock skew / request latency.
const EXPIRY_BUFFER_MS = 60_000

interface StoredAuth {
  accessToken: string
  refreshToken: string | null
  expiresAt: number // epoch ms
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

// In-memory cache so repeated calls within a page load avoid storage reads.
let cached: StoredAuth | null = null

function getClientId(): string {
  const manifest = chrome.runtime.getManifest() as { oauth2?: { client_id: string } }
  return manifest.oauth2?.client_id ?? ''
}

// --- PKCE helpers ---------------------------------------------------------

function base64url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

// --- Storage --------------------------------------------------------------

async function loadAuth(): Promise<StoredAuth | null> {
  if (cached) return cached
  const result = await chrome.storage.local.get([AUTH_KEY])
  const stored = result[AUTH_KEY] as StoredAuth | undefined
  if (stored?.accessToken) {
    cached = stored
    return stored
  }
  return null
}

async function persist(data: TokenResponse, prevRefresh: string | null): Promise<StoredAuth> {
  const auth: StoredAuth = {
    accessToken: data.access_token,
    // A refresh response omits refresh_token; keep the one we already hold.
    refreshToken: data.refresh_token ?? prevRefresh,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  cached = auth
  await chrome.storage.local.set({ [AUTH_KEY]: auth })
  await chrome.storage.local.remove([LEGACY_TOKEN_KEY])
  return auth
}

async function clearStoredAuth(): Promise<void> {
  cached = null
  await chrome.storage.local.remove([AUTH_KEY, LEGACY_TOKEN_KEY])
}

// --- OAuth flows ----------------------------------------------------------

function buildAuthUrl(codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline', // ask Google for a refresh token
    prompt: 'consent', // force a refresh token even on re-authorization
  })
  return `${AUTH_ENDPOINT}?${params}`
}

function parseCode(redirectUrl: string): string | null {
  try {
    return new URL(redirectUrl).searchParams.get('code')
  } catch {
    return null
  }
}

async function exchangeCode(code: string, verifier: string): Promise<StoredAuth | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: chrome.identity.getRedirectURL(),
    }),
  })
  if (!res.ok) {
    console.error('[Drive auth] token exchange failed:', res.status, await res.text().catch(() => ''))
    return null
  }
  return persist(await res.json(), null)
}

// Interactive: opens Google's consent screen and exchanges the code.
async function runAuthCodeFlow(): Promise<StoredAuth | null> {
  const verifier = randomVerifier()
  const challenge = await challengeFromVerifier(verifier)

  const redirectUrl = await new Promise<string | null>(resolve => {
    chrome.identity.launchWebAuthFlow(
      { url: buildAuthUrl(challenge), interactive: true },
      url => {
        const err = chrome.runtime?.lastError?.message
        if (err || !url) {
          if (err) console.error('[Drive auth] launchWebAuthFlow error:', err)
          resolve(null)
          return
        }
        resolve(url)
      }
    )
  })

  if (!redirectUrl) return null
  const code = parseCode(redirectUrl)
  if (!code) return null
  return exchangeCode(code, verifier)
}

// Silent: trades the refresh token for a new access token. No window, no UI.
async function refreshAccessToken(refreshToken: string): Promise<StoredAuth | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    // 400 invalid_grant means the refresh token was revoked or expired.
    console.error('[Drive auth] token refresh failed:', res.status)
    return null
  }
  return persist(await res.json(), refreshToken)
}

// --- Public API -----------------------------------------------------------

/**
 * Returns a valid Drive access token, refreshing silently when the cached one
 * has expired. Only falls back to the interactive consent screen when there is
 * no refresh token (first connect) or the refresh token is no longer valid.
 * With interactive=false, returns null instead of prompting.
 */
export async function getToken(interactive = true): Promise<string | null> {
  const auth = await loadAuth()

  if (auth) {
    if (Date.now() < auth.expiresAt - EXPIRY_BUFFER_MS) return auth.accessToken
    if (auth.refreshToken) {
      const refreshed = await refreshAccessToken(auth.refreshToken)
      if (refreshed) return refreshed.accessToken
      // Refresh token is dead — drop it and re-authorize if allowed.
      await clearStoredAuth()
    }
  }

  if (!interactive) return null
  const fresh = await runAuthCodeFlow()
  return fresh?.accessToken ?? null
}

/**
 * Marks the cached access token as expired without discarding the refresh
 * token, so the next getToken() performs a silent refresh. Used when the API
 * rejects an access token mid-flight (401).
 */
export async function invalidateAccessToken(): Promise<void> {
  const auth = await loadAuth()
  if (!auth) return
  const updated = { ...auth, expiresAt: 0 }
  cached = updated
  await chrome.storage.local.set({ [AUTH_KEY]: updated })
}

/** Clears the local auth without contacting Google. Exposed for tests/reset. */
export async function clearStoredTokens(): Promise<void> {
  await clearStoredAuth()
}

/**
 * Revokes the grant at Google (severing the refresh token) and clears the
 * local copy. Used by "Disconnect" so the connection is truly ended.
 */
export async function revokeActiveToken(): Promise<void> {
  const auth = await loadAuth()
  // Revoking the refresh token also invalidates its access tokens.
  const token = auth?.refreshToken ?? auth?.accessToken
  if (token) {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    }).catch(() => {})
  }
  await clearStoredAuth()
}
