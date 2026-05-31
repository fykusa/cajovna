// frontend/src/router/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '../store/authStore'
import type { User } from '../types'

interface Props {
  children: ReactNode
  requiredRole: User['role']
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== requiredRole) {
    return <Navigate to="/403" replace />
  }

  return <>{children}</>
}
