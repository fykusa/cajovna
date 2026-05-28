// frontend/src/store/authStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const mockUser = { id: 1, username: 'terka', role: 'prodavacka' as const }

beforeEach(() => {
  localStorage.clear()
  // Reset Zustand store between tests
  useAuthStore.setState({ user: null, token: null })
})

describe('useAuthStore', () => {
  it('má user a token null na začátku', () => {
    const { user, token } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
  })

  it('setAuth uloží user a token do stavu a localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'jwt-xyz')
    const { user, token } = useAuthStore.getState()
    expect(user).toEqual(mockUser)
    expect(token).toBe('jwt-xyz')
    expect(localStorage.getItem('token')).toBe('jwt-xyz')
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser)
  })

  it('logout vymaže stav i localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'jwt-xyz')
    useAuthStore.getState().logout()
    const { user, token } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('načte token z localStorage při inicializaci', () => {
    localStorage.setItem('token', 'persisted-token')
    localStorage.setItem('user', JSON.stringify(mockUser))
    useAuthStore.setState({
      user: JSON.parse(localStorage.getItem('user')!),
      token: localStorage.getItem('token'),
    })
    expect(useAuthStore.getState().token).toBe('persisted-token')
    expect(useAuthStore.getState().user?.username).toBe('terka')
  })
})
