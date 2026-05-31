// frontend/src/api/products.ts
import { apiFetch } from './client'
import type { Tea, Category } from '../types'

export const getProducts = (params?: { category_id?: number; search?: string }): Promise<Tea[]> => {
  const q = new URLSearchParams()
  if (params?.category_id) q.set('category_id', String(params.category_id))
  if (params?.search) q.set('search', params.search)
  const qs = q.toString() ? `?${q}` : ''
  return apiFetch<Tea[]>(`/products${qs}`)
}

export const getCategories = (): Promise<Category[]> =>
  apiFetch<Category[]>('/products/categories')

export const updateProduct = (id: number, data: Partial<Tea>): Promise<Tea> =>
  apiFetch<Tea>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteProduct = (id: number): Promise<void> =>
  apiFetch<void>(`/products/${id}`, { method: 'DELETE' })
