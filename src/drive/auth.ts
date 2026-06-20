export async function getToken(interactive = true): Promise<string | null> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, token => {
      const err = chrome.runtime?.lastError?.message
      if (err) {
        // Non-interactive failures are expected when no token is cached
        interactive ? reject(new Error(err)) : resolve(null)
        return
      }
      resolve(token ?? null)
    })
  })
}

export async function revokeToken(token: string): Promise<void> {
  return new Promise(resolve => {
    chrome.identity.removeCachedAuthToken({ token }, resolve)
  })
}
