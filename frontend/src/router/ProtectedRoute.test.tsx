// frontend/src/router/ProtectedRoute.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import type { User } from '../types'

// Mock auth store – stav nastavíme per test
interface AuthState {
  user: User | null
  token: string | null
}
const mockState: AuthState = { user: null, token: null }

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) => selector(mockState),
}))

function renderWithRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/403" element={<div>403 page</div>} />
        <Route
          path="/pos"
          element={
            <ProtectedRoute requiredRole="prodavacka">
              <div>POS page</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <div>Admin page</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('přesměruje na /login pokud není token', () => {
    mockState.user = null
    mockState.token = null
    renderWithRoute('/pos')
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('zobrazí obsah přihlášenému uživateli se správnou rolí', () => {
    mockState.user = { id: 1, username: 'terka', role: 'prodavacka' }
    mockState.token = 'tok'
    renderWithRoute('/pos')
    expect(screen.getByText('POS page')).toBeInTheDocument()
  })

  it('přesměruje na /403 pokud má uživatel špatnou roli', () => {
    mockState.user = { id: 1, username: 'terka', role: 'prodavacka' }
    mockState.token = 'tok'
    renderWithRoute('/admin')
    expect(screen.getByText('403 page')).toBeInTheDocument()
  })

  it('admin může přistupovat na admin route', () => {
    mockState.user = { id: 2, username: 'boss', role: 'admin' }
    mockState.token = 'tok'
    renderWithRoute('/admin')
    expect(screen.getByText('Admin page')).toBeInTheDocument()
  })
})
