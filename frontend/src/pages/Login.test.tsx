import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Login from './Login'

vi.mock('../api/auth', () => ({
  login: vi.fn(),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({ user: null, token: null, setAuth: mockSetAuth, logout: vi.fn() }),
}))

const mockSetAuth = vi.fn()
const mockLogin = vi.mocked((await import('../api/auth')).login)

beforeEach(() => {
  vi.clearAllMocks()
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pos" element={<div>POS page</div>} />
        <Route path="/admin" element={<div>Admin page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Login', () => {
  it('zobrazí formulář s polem pro jméno, heslo a tlačítko', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('Uživatelské jméno')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Heslo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Přihlásit' })).toBeInTheDocument()
  })

  it('zavolá login() s vyplněnými hodnotami', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'tok',
      user: { id: 1, username: 'terka', role: 'prodavacka' },
    })
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo123')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    expect(mockLogin).toHaveBeenCalledWith('terka', 'heslo123')
  })

  it('zavolá setAuth po úspěšném přihlášení', async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce({
      token: 'tok',
      user: { id: 1, username: 'terka', role: 'prodavacka' },
    })
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo123')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    await waitFor(() => expect(mockSetAuth).toHaveBeenCalledWith(
      { id: 1, username: 'terka', role: 'prodavacka' },
      'tok'
    ))
  })

  it('zobrazí chybovou zprávu při neúspěšném přihlášení', async () => {
    const user = userEvent.setup()
    const { ApiError } = await import('../api/client')
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'Invalid credentials'))
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'x')
    await user.type(screen.getByPlaceholderText('Heslo'), 'y')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'))
  })

  it('deaktivuje tlačítko během načítání', async () => {
    const user = userEvent.setup()
    let resolve: (v: any) => void = () => {}
    mockLogin.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    expect(screen.getByRole('button')).toBeDisabled()
    resolve({ token: 't', user: { id: 1, username: 'terka', role: 'prodavacka' } })
  })
})
