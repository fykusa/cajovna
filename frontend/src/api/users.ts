// frontend/src/api/users.ts
import { apiFetch } from './client'
import { User } from '../types'

export interface UserCreatePayload { username: string; password: string; role: User['role'] }
export interface UserUpdatePayload { username?: string; password?: string; role?: User['role']; active?: 0 | 1 }

export const getUsers = (): Promise<User[]> => apiFetch<User[]>('/users')
export const createUser = (data: UserCreatePayload): Promise<{ id: number }> =>
  apiFetch('/users', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id: number, data: UserUpdatePayload): Promise<void> =>
  apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteUser = (id: number): Promise<void> =>
  apiFetch(`/users/${id}`, { method: 'DELETE' })
