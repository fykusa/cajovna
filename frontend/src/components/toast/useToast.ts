import { useContext } from 'react'
import { ToastContext } from './ToastProvider'

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return {
    success: (message: string) => ctx.addToast('success', message),
    error: (message: string) => ctx.addToast('error', message),
  }
}
