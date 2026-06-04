import { useState } from 'react'
import Modal from '../Modal'
import { importDatabase } from '../../api/admin'
import { useToast } from '../toast/useToast'
import styles from './ImportDialog.module.css'

interface Props {
  onClose: () => void
  onDone: () => void
}

const GROUPS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'categories', label: 'Kategorie', defaultOn: true },
  { key: 'teas', label: 'Čaje', defaultOn: true },
  { key: 'bags', label: 'Pytlíky', defaultOn: true },
  { key: 'sales', label: 'Prodeje (restore)', defaultOn: false },
]

export default function ImportDialog({ onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(GROUPS.filter((g) => g.defaultOn).map((g) => g.key))
  )
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const tables = GROUPS.filter((g) => selected.has(g.key)).map((g) => g.key)
  const canSubmit = !!file && confirm === 'NAHRADIT' && tables.length > 0 && !busy

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const res = await importDatabase(file, tables)
      const summary = Object.entries(res.imported)
        .map(([t, n]) => `${t}: ${n}`)
        .join(', ')
      toast.success(`Import dokončen — ${summary}`)
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import se nezdařil')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Import databáze" onClose={onClose}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.warn}>
          Import přepíše vybrané tabulky daty ze souboru. Uživatelé se neimportují.
          Prodeje obnovuj jen pokud odpovídající uživatelé v databázi existují.
        </p>

        <input
          data-testid="import-file"
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <div className={styles.group}>
          {GROUPS.map((g) => (
            <label key={g.key} className={styles.check}>
              <input
                type="checkbox"
                checked={selected.has(g.key)}
                onChange={() => toggle(g.key)}
              />
              {g.label}
            </label>
          ))}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <input
          className={styles.confirm}
          placeholder="NAHRADIT"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <div className={styles.actions}>
          <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
            Importovat
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Zrušit
          </button>
        </div>
      </form>
    </Modal>
  )
}
