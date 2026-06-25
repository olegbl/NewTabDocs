const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_KEY = 'driveAccessToken'

// In-memory cache: prevents double popup within the same page load
let memoryToken: string | null = null

function getClientId(): string {
  const manifest = chrome.runtime.getManifest() as { oauth2?: { client_id: string } }
  return manifest.oauth2?.client_id ?? ''
}

function buildAuthUrl(silent: boolean): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: SCOPE,
  })
  if (silent) params.set('prompt', 'none')
  return `https://accounts.google.com/o/oauth2/auth?${params}`
}

function parseToken(redirectUrl: string): string | null {
  try {
    const hash = new URL(redirectUrl).hash.slice(1)
    return new URLSearchParams(hash).get('access_token')
  } catch {
    return null
  }
}

async function readStoredToken(): Promise<string | null> {
  const result = await chrome.storage.local.get([TOKEN_KEY])
  return (result[TOKEN_KEY] as string | undefined) ?? null
}

export async function getToken(interactive = true): Promise<string | null> {
  if (memoryToken) return memoryToken

  const stored = await readStoredToken()
  if (stored) { memoryToken = stored; return stored }

  const token = await new Promise<string | null>(resolve => {
    chrome.identity.launchWebAuthFlow(
      { url: buildAuthUrl(!interactive), interactive },
      redirectUrl => {
        const err = chrome.runtime?.lastError?.message
        if (err || !redirectUrl) {
          if (interactive) console.error('[Drive auth] launchWebAuthFlow error:', err)
          resolve(null)
          return
        }
        resolve(parseToken(redirectUrl))
      }
    )
  })

  if (token) {
    memoryToken = token
    await chrome.storage.local.set({ [TOKEN_KEY]: token })
  }
  return token
}

export async function clearCachedToken(): Promise<void> {
  memoryToken = null
  await chrome.storage.local.remove([TOKEN_KEY])
}

export async function revokeToken(token: string): Promise<void> {
  await clearCachedToken()
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  }).catch(() => {})
}

// Revoke the currently active token (in-memory or stored) at Google, then
// drop the local copy. Used by "Disconnect" so the grant is actually severed
// rather than just forgotten locally.
export async function revokeActiveToken(): Promise<void> {
  const token = memoryToken ?? (await readStoredToken())
  if (token) {
    await revokeToken(token)
  } else {
    await clearCachedToken()
  }
}
