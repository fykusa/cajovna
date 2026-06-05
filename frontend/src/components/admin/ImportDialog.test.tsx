import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportDialog from './ImportDialog'
import * as adminApi from '../../api/admin'
import { renderWithToast } from '../../test/renderWithToast'

vi.mock('../../api/admin', () => ({ importDatabase: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

function selectFile(input: HTMLInputElement, user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['x'], 'zaloha.zip', { type: 'application/zip' })
  return user.upload(input, file)
}

describe('ImportDialog', () => {
  it('Importovat je disabled bez souboru a bez potvrzení', () => {
    renderWithToast(<ImportDialog onClose={() => {}} onDone={() => {}} />)
    expect(screen.getByRole('button', { name: 'Importovat' })).toBeDisabled()
  })

  it('users checkbox neexistuje', () => {
    renderWithToast(<ImportDialog onClose={() => {}} onDone={() => {}} />)
    expect(screen.queryByLabelText(/uživatel/i)).not.toBeInTheDocument()
  })

  it('po vybrání souboru a napsání NAHRADIT zavolá importDatabase s vybranými skupinami', async () => {
    vi.mocked(adminApi.importDatabase).mockResolvedValueOnce({ imported: { teas: 1 } })
    const onDone = vi.fn()
    const user = userEvent.setup()
    renderWithToast(<ImportDialog onClose={() => {}} onDone={onDone} />)

    await selectFile(screen.getByTestId('import-file') as HTMLInputElement, user)
    await user.type(screen.getByPlaceholderText('NAHRADIT'), 'NAHRADIT')
    await user.click(screen.getByRole('button', { name: 'Importovat' }))

    expect(adminApi.importDatabase).toHaveBeenCalledWith(
      expect.any(File),
      ['categories', 'teas', 'bags'] // default zaškrtnuté, prodeje vypnuté
    )
  })
})
