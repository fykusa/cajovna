// frontend/src/api/bags.ts
import { apiFetch } from './client'
import type { Bag } from '../types'

export const getBags = (): Promise<Bag[]> => apiFetch<Bag[]>('/bags')
