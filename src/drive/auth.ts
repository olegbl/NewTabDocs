export async function getToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      resolve(token ?? null)
    })
  })
}

export async function revokeToken(token: string): Promise<void> {
  return new Promise(resolve => {
    chrome.identity.removeCachedAuthToken({ token }, resolve)
  })
}
