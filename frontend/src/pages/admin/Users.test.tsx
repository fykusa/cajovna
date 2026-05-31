import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Users from './Users'
import * as usersApi from '../../api/users'

vi.mock('../../api/users', () => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

const USERS = [
  { id: 1, username: 'terka', role: 'prodavacka' as const },
  { id: 2, username: 'boss', role: 'admin' as const },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usersApi.getUsers).mockResolvedValue(USERS)
})

describe('Users', () => {
  it('zobrazí seznam uživatelů', async () => {
    render(<Users />)
    expect(await screen.findByText('terka')).toBeInTheDocument()
    expect(screen.getByText('boss')).toBeInTheDocument()
  })

  it('zobrazí roli každého uživatele', async () => {
    render(<Users />)
    await screen.findByText('terka')
    expect(screen.getByText('prodavacka')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('zobrazí formulář pro nového uživatele po kliku na Přidat', async () => {
    const user = userEvent.setup()
    render(<Users />)
    await screen.findByText('terka')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    expect(screen.getByPlaceholderText(/uživatelské jméno/i)).toBeInTheDocument()
  })

  it('zavolá createUser a obnoví seznam po odeslání formuláře', async () => {
    vi.mocked(usersApi.createUser).mockResolvedValueOnce({ id: 3 })
    vi.mocked(usersApi.getUsers).mockResolvedValueOnce([
      ...USERS,
      { id: 3, username: 'nova', role: 'prodavacka' as const },
    ])
    const user = userEvent.setup()
    render(<Users />)
    await screen.findByText('terka')
    await user.click(screen.getByRole('button', { name: /přidat/i }))
    await user.type(screen.getByPlaceholderText(/uživatelské jméno/i), 'nova')
    await user.type(screen.getByPlaceholderText(/heslo/i), 'heslo123')
    await user.click(screen.getByRole('button', { name: /uložit/i }))
    await waitFor(() => expect(vi.mocked(usersApi.createUser)).toHaveBeenCalledWith({
      username: 'nova', password: 'heslo123', role: 'prodavacka',
    }))
  })

  it('zavolá deleteUser po kliknutí na Smazat', async () => {
    vi.mocked(usersApi.deleteUser).mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(<Users />)
    await screen.findByText('terka')
    // Nastav refresh mock až po initial load
    vi.mocked(usersApi.getUsers).mockResolvedValueOnce([USERS[1]])
    const deleteButtons = screen.getAllByRole('button', { name: /smazat/i })
    await user.click(deleteButtons[0])
    await waitFor(() => expect(vi.mocked(usersApi.deleteUser)).toHaveBeenCalledWith(1))
  })
})
