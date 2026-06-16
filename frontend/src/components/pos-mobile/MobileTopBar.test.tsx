// frontend/src/components/pos-mobile/MobileTopBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileTopBar from './MobileTopBar'

describe('MobileTopBar', () => {
  it('renderuje tlačítko Pokladna', () => {
    const onModeChange = vi.fn()
    render(
      <MobileTopBar
        mode="pos"
        onModeChange={onModeChange}
        username="test"
        onLogout={vi.fn()}
      />
    )
    expect(screen.getByText('Pokladna')).toBeInTheDocument()
  })

  it('klik na Pokladna volá onModeChange("kasa")', async () => {
    const onModeChange = vi.fn()
    render(
      <MobileTopBar
        mode="pos"
        onModeChange={onModeChange}
        username="test"
        onLogout={vi.fn()}
      />
    )
    await userEvent.click(screen.getByText('Pokladna'))
    expect(onModeChange).toHaveBeenCalledWith('kasa')
  })
})
