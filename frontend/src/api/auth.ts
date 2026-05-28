// frontend/src/api/auth.ts
import { apiFetch } from './client'
import { User } from '../types'

export interface LoginResponse {
  token: string
  user: User
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}
