import { createContext, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import ToastContainer from './ToastContainer'

export type ToastType = 'success' | 'error'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: number) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext<ToastContextValue | null>(null)

const SUCCESS_DURATION_MS = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current
      setToasts((prev) => [{ id, type, message }, ...prev]) // nejnovější nahoře
      if (type === 'success') {
        setTimeout(() => removeToast(id), SUCCESS_DURATION_MS)
      }
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}
