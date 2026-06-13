import { apiFetch } from './client'
import type { CajovnaProdej, CajePolozkaSale, CajeCategory } from '../types'

export interface CajePolozkaSend {
  caje_id: number
  baleni: 1 | 2 | 3 | 4
  kusu: number
  jedn_cena: number
  celk_cena: number
}

export interface CajovnaSaleResponse {
  prodej_id: number
  total: number
}

export const createCajovnaSale = (polozky: CajePolozkaSend[]): Promise<CajovnaSaleResponse> =>
  apiFetch<CajovnaSaleResponse>('/cajovna/prodej', {
    method: 'POST',
    body: JSON.stringify({ polozky }),
  })

export const getCajovnaProdeje = (params?: { from?: string; to?: string; kategorie?: string; zeme?: string | null }): Promise<CajovnaProdej[]> => {
  const parts: string[] = []
  if (params?.from)      parts.push(`from=${encodeURIComponent(params.from)}`)
  if (params?.to)        parts.push(`to=${encodeURIComponent(params.to)}`)
  if (params?.kategorie) parts.push(`kategorie=${encodeURIComponent(params.kategorie)}`)
  if (params?.zeme)      parts.push(`zeme=${encodeURIComponent(params.zeme)}`)
  const qs = parts.length ? `?${parts.join('&')}` : ''
  return apiFetch<CajovnaProdej[]>(`/cajovna/prodeje${qs}`)
}

export const getCajovnaKategorie = (): Promise<CajeCategory[]> =>
  apiFetch<CajeCategory[]>('/cajovna/kategorie')

export const getCajovnaPolozky = (prodejId: number): Promise<CajePolozkaSale[]> =>
  apiFetch<CajePolozkaSale[]>(`/cajovna/prodeje/${prodejId}/polozky`)
