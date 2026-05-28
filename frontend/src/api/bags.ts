// frontend/src/api/bags.ts
import { apiFetch } from './client'
import { Bag } from '../types'

export const getBags = (): Promise<Bag[]> => apiFetch<Bag[]>('/bags')
