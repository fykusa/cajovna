import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function Harness() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Uloženo')}>ok</button>
      <button onClick={() => toast.error('Chyba operace')}>err</button>
    </div>
  )
}

describe('ToastProvider / useToast', () => {
  it('success se zobrazí a po 3 s sám zmizí', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Harness />
        </ToastProvider>
      )
      fireEvent.click(screen.getByText('ok'))
      expect(screen.getByText('Uloženo')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.queryByText('Uloženo')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('error zůstane i po čase a zavře se křížkem', () => {
    vi.useFakeTimers()
    try {
      render(
        <ToastProvider>
          <Harness />
        </ToastProvider>
      )
      fireEvent.click(screen.getByText('err'))
      expect(screen.getByText('Chyba operace')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(10000)
      })
      expect(screen.getByText('Chyba operace')).toBeInTheDocument() // pořád tu je
      fireEvent.click(screen.getByLabelText('Zavřít'))
      expect(screen.queryByText('Chyba operace')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('víc toastů se zobrazí současně (stohování)', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('err'))
    fireEvent.click(screen.getByText('err'))
    expect(screen.getAllByText('Chyba operace')).toHaveLength(2)
  })

  it('useToast mimo ToastProvider vyhodí chybu', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})
