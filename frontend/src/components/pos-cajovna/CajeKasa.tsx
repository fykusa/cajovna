import { useState, useEffect, useCallback } from 'react'
import { getKasaStatus, addKasaMovement } from '../../api/kasa'
import type { KasaStatus } from '../../types'
import styles from './CajeKasa.module.css'

const fmtKc = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

const fmtDate = (s: string) => {
  const [, m, d] = s.split('-')
  return `${parseInt(d)}.${parseInt(m)}.`
}

type NoteType = 'vybrani' | 'vlozeni' | 'vlastni'

export default function CajeKasa() {
  const [status, setStatus]         = useState<KasaStatus | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [noteType, setNoteType]     = useState<NoteType>('vybrani')
  const [amount, setAmount]         = useState(0)
  const [customNote, setCustomNote] = useState('')
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  const loadStatus = useCallback(() => {
    setLoading(true)
    setError(null)
    return getKasaStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  function resetForm() {
    setShowForm(false)
    setNoteType('vybrani')
    setAmount(0)
    setCustomNote('')
    setFormError(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (noteType === 'vybrani' && status) {
      const balance = status.stav_kasy ?? (status.trzby_dnes + status.pohyby_dnes)
      if (Math.abs(amount) > balance) {
        setFormError(`Výběr ${fmtKc(Math.abs(amount))} přesahuje stav kasy (${fmtKc(balance)})`)
        return
      }
    }
    setSaving(true)
    setFormError(null)
    try {
      const finalAmount = noteType === 'vlastni'
        ? amount
        : noteType === 'vybrani' ? -Math.abs(amount) : Math.abs(amount)
      const finalNote = noteType === 'vlastni'
        ? customNote
        : noteType === 'vybrani' ? 'výběr' : 'vložení'
      await addKasaMovement(finalAmount, finalNote)
      resetForm()
      await loadStatus()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Chyba přidání pohybu')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className={styles.state}>Načítám…</div>
  if (error)   return <div className={styles.state}>Chyba: {error}</div>
  if (!status) return null

  return (
    <div className={styles.wrap}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.label}>Poslední uzávěrka</div>
          <div className={styles.value} data-testid="stat-uzaverka">
            {status.last_closing
              ? <>{fmtKc(status.last_closing.confirmed_balance)} <span className={styles.dateHint}>({fmtDate(status.last_closing.date)})</span></>
              : '?'}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.label}>Tržby dnes</div>
          <div className={styles.value} data-testid="stat-trzby">{fmtKc(status.trzby_dnes)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.label}>Pohyby dnes</div>
          <div className={styles.value} data-testid="stat-pohyby">{fmtKc(status.pohyby_dnes)}</div>
        </div>
        <div className={`${styles.stat} ${styles.statTotal}`}>
          <div className={styles.label}>Aktuální stav kasy</div>
          <div className={styles.value} data-testid="stat-stav">
            {status.stav_kasy !== null
              ? fmtKc(status.stav_kasy)
              : `? + ${fmtKc(status.trzby_dnes + status.pohyby_dnes)}`}
          </div>
        </div>
      </div>

      {!showForm ? (
        <button className={styles.addBtn} onClick={() => setShowForm(true)}>
          + Přidat pohyb
        </button>
      ) : (
        <form className={styles.form} onSubmit={handleAdd} data-testid="add-form">
          {formError && <div className={styles.formError}>{formError}</div>}
          <select
            className={styles.select}
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as NoteType)}
          >
            <option value="vybrani">výběr</option>
            <option value="vlozeni">vložení</option>
            <option value="vlastni">vlastní</option>
          </select>
          {noteType === 'vlastni' && (
            <input
              className={styles.input}
              type="text"
              placeholder="Poznámka"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              required
            />
          )}
          <div className={styles.amountRow}>
            {noteType !== 'vlastni' && (
              <span className={noteType === 'vybrani' ? styles.neg : styles.pos}>
                {noteType === 'vybrani' ? '−' : '+'}
              </span>
            )}
            <input
              className={`${styles.input} ${styles.amountInput}`}
              type="number"
              placeholder="Částka"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              autoFocus
              min={1}
            />
          </div>
          <div className={styles.formBtns}>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Ukládám…' : 'Přidat'}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={resetForm}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      {status.movements.length > 0 && (
        <div className={styles.movements} data-testid="movements-section">
          <div className={styles.movTitle}>Pohyby dnes</div>
          {status.movements.map((m) => (
            <div key={m.id} className={styles.movement}>
              <span className={styles.movTime}>
                {new Date(m.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`${styles.movAmount} ${m.amount >= 0 ? styles.pos : styles.neg}`}>
                {m.amount >= 0 ? '+' : ''}{fmtKc(m.amount)}
              </span>
              <span className={styles.movNote}>{m.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
