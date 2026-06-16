import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminLayout from './AdminLayout'

vi.mock('../../store/authStore', () => ({
  useAuthStore: (s: (state: { user: { id: number; username: string; role: string } | null; logout: () => void }) => unknown) =>
    s({ user: { id: 1, username: 'admin', role: 'admin' }, logout: vi.fn() }),
}))

function setup(initialPath = '/admin/kasa') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminLayout />
    </MemoryRouter>
  )
}

describe('AdminLayout nav', () => {
  it('zobrazí odkaz na Kasa', () => {
    setup()
    const link = screen.getByRole('link', { name: 'Kasa' })
    expect(link).toBeInTheDocument()
  })

  it('odkaz na Kasa míří na /admin/kasa', () => {
    setup()
    const link = screen.getByRole('link', { name: 'Kasa' })
    expect(link).toHaveAttribute('href', '/admin/kasa')
  })
})
