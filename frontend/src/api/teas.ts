import { apiFetch } from './client'
import type { TeaRow, ProduktTyp } from '../types'

const PRODUKT_ENDPOINTS: Record<ProduktTyp, string> = {
  caje: 'teas',
  nadobi: 'nadobi',
  etnoshop: 'etnoshop',
}

export const getProdukty = (
  typ: ProduktTyp,
  params?: { search?: string; kategorie?: string; aktiv?: string },
): Promise<TeaRow[]> => {
  const q = new URLSearchParams()
  if (params?.search)    q.set('search', params.search)
  if (params?.kategorie) q.set('kategorie', params.kategorie)
  if (params?.aktiv !== undefined) q.set('aktiv', params.aktiv)
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<TeaRow[]>(`/${PRODUKT_ENDPOINTS[typ]}${qs}`)
}
