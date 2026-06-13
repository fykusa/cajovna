import { apiFetch } from './client'
import type { CajovnaProdej } from '../types'

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

export const getCajovnaProdeje = (): Promise<CajovnaProdej[]> =>
  apiFetch<CajovnaProdej[]>('/cajovna/prodeje')
