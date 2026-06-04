// frontend/src/api/auth.ts
import { apiFetch } from './client'
import type { User } from '../types'

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

/** Self-service změna vlastního hesla (z přihlašovací stránky, bez přihlášení). */
export function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      username,
      old_password: oldPassword,
      new_password: newPassword,
    }),
  })
}
