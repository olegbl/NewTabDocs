export function deriveTitle(content: string): string {
  const firstLine = content.split('\n').find(line => line.trim() !== '')
  if (!firstLine) return 'Untitled'
  return firstLine.replace(/^#+\s*/, '').trim() || 'Untitled'
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function generateId(): string {
  return crypto.randomUUID()
}

// Returns the URL only if it uses a safe, navigable scheme (http/https).
// Guards window.open against script-bearing schemes like javascript: and data:.
export function safeExternalUrl(raw: string): string | null {
  try {
    const protocol = new URL(raw).protocol
    return protocol === 'http:' || protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}
