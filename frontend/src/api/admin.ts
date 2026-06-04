import { useAuthStore } from '../store/authStore'
import { ApiError } from './client'

export interface ImportResult {
  imported: Record<string, number>
}

function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Stáhne ZIP zálohy celé DB. */
export async function exportDatabase(): Promise<void> {
  const res = await fetch('/api/admin/export', { headers: { ...authHeader() } })
  if (!res.ok) {
    throw new ApiError(res.status, 'Export se nezdařil')
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const m = cd.match(/filename="([^"]+)"/)
  const name = m ? m[1] : `cajovna-zaloha-${new Date().toISOString().slice(0, 10)}.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Nahraje ZIP a naimportuje vybrané skupiny (categories|teas|bags|sales). */
export async function importDatabase(file: File, tables: string[]): Promise<ImportResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('tables', JSON.stringify(tables))
  const res = await fetch('/api/admin/import', {
    method: 'POST',
    headers: { ...authHeader() }, // bez Content-Type → browser nastaví multipart boundary
    body: fd,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'Import se nezdařil')
  }
  return data as ImportResult
}
