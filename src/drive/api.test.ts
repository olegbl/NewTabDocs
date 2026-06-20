import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFileMeta, downloadFile, uploadFile } from './api'
import type { DriveBackup } from '../types'

const FILE_NAME = 'newtabdocs-backup.json'
const TOKEN = 'test-token'
const FILE_ID = 'file-123'
const ETAG = '"etag-abc"'

const mockFileMeta = { id: FILE_ID, etag: ETAG, modifiedTime: '2026-01-01T00:00:00Z' }
const mockBackup: DriveBackup = { tabs: [], savedAt: 1000 }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('getFileMeta', () => {
  it('returns file meta when file exists', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFileMeta] }),
      } as Response)
    const meta = await getFileMeta(TOKEN)
    expect(meta).toEqual(mockFileMeta)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(FILE_NAME),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    )
  })

  it('returns null when no file found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)
    const meta = await getFileMeta(TOKEN)
    expect(meta).toBeNull()
  })
})

describe('downloadFile', () => {
  it('returns parsed JSON from Drive', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBackup,
    } as Response)
    const data = await downloadFile(TOKEN, FILE_ID)
    expect(data).toEqual(mockBackup)
  })
})

describe('uploadFile', () => {
  it('creates a new file when fileId is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: FILE_ID, etag: ETAG }),
    } as Response)
    const result = await uploadFile(TOKEN, null, mockBackup)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('upload/drive/v3/files'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toEqual({ id: FILE_ID, etag: ETAG })
  })

  it('updates existing file when fileId is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: FILE_ID, etag: '"etag-new"' }),
    } as Response)
    const result = await uploadFile(TOKEN, FILE_ID, mockBackup)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(FILE_ID),
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(result.etag).toBe('"etag-new"')
  })
})
