const SCOPE = 'https://www.googleapis.com/auth/drive.file'

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

export async function getToken(interactive = true): Promise<string | null> {
  return new Promise(resolve => {
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
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' })
}
