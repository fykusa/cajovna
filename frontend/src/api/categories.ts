// frontend/src/api/categories.ts
import { apiFetch } from './client'
import type { Category } from '../types'

export const getCategories = (): Promise<Category[]> => apiFetch<Category[]>('/categories')

export const createCategory = (data: Partial<Category>): Promise<Category> =>
  apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(data) })

export const updateCategory = (id: number, data: Partial<Category>): Promise<Category> =>
  apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteCategory = (id: number): Promise<void> =>
  apiFetch<void>(`/categories/${id}`, { method: 'DELETE' })
