// frontend/src/api/bags.ts
import { apiFetch } from './client'
import type { Bag } from '../types'

export const getBags = (): Promise<Bag[]> => apiFetch<Bag[]>('/bags')

export const createBag = (data: Partial<Bag>): Promise<Bag> =>
  apiFetch<Bag>('/bags', { method: 'POST', body: JSON.stringify(data) })

export const updateBag = (id: number, data: Partial<Bag>): Promise<Bag> =>
  apiFetch<Bag>(`/bags/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteBag = (id: number): Promise<void> =>
  apiFetch<void>(`/bags/${id}`, { method: 'DELETE' })
