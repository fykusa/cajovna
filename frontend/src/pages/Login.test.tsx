import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import * as authApi from '../api/auth'
import { ApiError } from '../api/client'
import type { User } from '../types'
import Login from './Login'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

const mockSetAuth = vi.fn()

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  changePassword: vi.fn(),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (state: AuthState) => unknown) =>
    selector({ user: null, token: null, setAuth: mockSetAuth, logout: vi.fn() }),
}))

const mockLogin = vi.mocked(authApi.login)
const mockChangePassword = vi.mocked(authApi.changePassword)

beforeEach(() => {
  vi.clearAllMocks()
})

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cajovna" element={<div>Cajovna page</div>} />
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
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'Invalid credentials'))
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'x')
    await user.type(screen.getByPlaceholderText('Heslo'), 'y')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'))
  })

  it('deaktivuje tlačítko během načítání', async () => {
    const user = userEvent.setup()
    let resolve: (v: { token: string; user: User }) => void = () => {}
    mockLogin.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    renderLogin()
    await user.type(screen.getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(screen.getByPlaceholderText('Heslo'), 'heslo')
    await user.click(screen.getByRole('button', { name: 'Přihlásit' }))
    expect(screen.getByRole('button', { name: 'Přihlašování…' })).toBeDisabled()
    resolve({ token: 't', user: { id: 1, username: 'terka', role: 'prodavacka' } })
  })

  it('umožní změnu hesla přes modal a zavolá changePassword', async () => {
    const user = userEvent.setup()
    mockChangePassword.mockResolvedValueOnce({ message: 'Heslo změněno' })
    renderLogin()
    await user.click(screen.getByRole('button', { name: 'Změnit heslo' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByPlaceholderText('Uživatelské jméno'), 'terka')
    await user.type(within(dialog).getByPlaceholderText('Stávající heslo'), 'stare123')
    await user.type(within(dialog).getByPlaceholderText(/Nové heslo/), 'nove123')
    await user.click(within(dialog).getByRole('button', { name: 'Změnit heslo' }))
    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith('terka', 'stare123', 'nove123')
    )
    expect(await screen.findByText(/Heslo bylo změněno/)).toBeInTheDocument()
  })
})
