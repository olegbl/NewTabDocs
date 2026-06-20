import type { DriveBackup, DriveFile } from '../types'

const FILE_NAME = 'newtabdocs-backup.json'
const BASE = 'https://www.googleapis.com'

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[Drive API] ${res.status} ${res.url}\n${body}`)
    throw new Error(`Drive API ${res.status}`)
  }
}

export async function getFileMeta(token: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)
  const fields = 'files(id,etag,modifiedTime)'
  const res = await fetch(
    `${BASE}/drive/v3/files?q=${q}&fields=${fields}&spaces=drive`,
    { headers: { ...authHeader(token), 'Content-Type': 'application/json' } }
  )
  await assertOk(res)
  const data = await res.json()
  return data.files?.[0] ?? null
}

export async function downloadFile(token: string, fileId: string): Promise<DriveBackup> {
  const res = await fetch(
    `${BASE}/drive/v3/files/${fileId}?alt=media`,
    { headers: authHeader(token) }
  )
  await assertOk(res)
  return res.json()
}

export async function uploadFile(
  token: string,
  fileId: string | null,
  backup: DriveBackup
): Promise<{ id: string; etag: string }> {
  const metadata = fileId ? {} : { name: FILE_NAME, mimeType: 'application/json' }
  const body = new FormData()
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  body.append('media', new Blob([JSON.stringify(backup)], { type: 'application/json' }))

  const url = fileId
    ? `${BASE}/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,etag`
    : `${BASE}/upload/drive/v3/files?uploadType=multipart&fields=id,etag`

  const res = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: authHeader(token),
    body,
  })
  await assertOk(res)
  return res.json()
}
