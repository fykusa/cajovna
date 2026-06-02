import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { ToastProvider } from '../components/toast/ToastProvider'

export function renderWithToast(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}
