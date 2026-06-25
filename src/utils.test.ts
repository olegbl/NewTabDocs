import { describe, it, expect } from 'vitest'
import { deriveTitle, formatRelativeTime, generateId, safeExternalUrl } from './utils'

describe('deriveTitle', () => {
  it('returns first line stripped of leading # chars', () => {
    expect(deriveTitle('# Hello World\nsome content')).toBe('Hello World')
  })

  it('handles ## headings', () => {
    expect(deriveTitle('## Section\nstuff')).toBe('Section')
  })

  it('returns first line as-is when no heading prefix', () => {
    expect(deriveTitle('Plain line\nmore stuff')).toBe('Plain line')
  })

  it('skips empty lines to find first non-empty line', () => {
    expect(deriveTitle('\n\n# After blank\ncontent')).toBe('After blank')
  })

  it('returns "Untitled" when content is empty', () => {
    expect(deriveTitle('')).toBe('Untitled')
  })

  it('returns "Untitled" when content is only whitespace', () => {
    expect(deriveTitle('   \n\n  ')).toBe('Untitled')
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps within 60 seconds', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 30_000)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5 minutes ago')
  })

  it('returns "1 minute ago" singular', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 90_000)).toBe('1 minute ago')
  })

  it('returns hours ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 2 * 3600_000)).toBe('2 hours ago')
  })

  it('returns "yesterday" for ~24 hours ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 25 * 3600_000)).toBe('yesterday')
  })

  it('returns days ago beyond 2 days', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 3 * 86400_000)).toBe('3 days ago')
  })
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string')
    expect(generateId().length).toBeGreaterThan(0)
  })

  it('returns unique values on each call', () => {
    expect(generateId()).not.toBe(generateId())
  })
})

describe('safeExternalUrl', () => {
  it('allows http URLs', () => {
    expect(safeExternalUrl('http://example.com/x')).toBe('http://example.com/x')
  })

  it('allows https URLs', () => {
    expect(safeExternalUrl('https://example.com/x?y=1')).toBe('https://example.com/x?y=1')
  })

  it('rejects javascript: URLs', () => {
    expect(safeExternalUrl('javascript:alert(document.cookie)')).toBeNull()
  })

  it('rejects data: URLs', () => {
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('rejects other schemes like mailto: and file:', () => {
    expect(safeExternalUrl('mailto:a@b.com')).toBeNull()
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects non-URL / relative strings', () => {
    expect(safeExternalUrl('not a url')).toBeNull()
    expect(safeExternalUrl('/relative/path')).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
  })
})
