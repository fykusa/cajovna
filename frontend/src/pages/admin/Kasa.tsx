import { useState, useEffect, useCallback, useRef } from 'react'
import type { KasaStatus, CashMovement, CashClosing } from '../../types'
import {
  getKasaStatus,
  addKasaMovement,
  getKasaMovements,
  closeKasa,
  getKasaClosings,
} from '../../api/kasa'
import Modal from '../../components/Modal'
import { periodRange, type Period } from './periodRange'
import styles from './Kasa.module.css'

const fmtKc = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

const fmtDate = (s: string) => {
  const d = new Date(s)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function sevenDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function Kasa() {
  const [status, setStatus]             = useState<KasaStatus | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [addAmount, setAddAmount]       = useState(0)
  const [noteType, setNoteType]         = useState<'vybrani' | 'vlozeni' | 'vlastni'>('vybrani')
  const [customNote, setCustomNote]     = useState('')
  const [saving, setSaving]             = useState(false)
  const [closeBalance, setCloseBalance] = useState(0)
  const [closeNote, setCloseNote]       = useState('')
  const [closings, setClosings]         = useState<CashClosing[]>([])
  const [movements, setMovements]       = useState<CashMovement[]>([])
  const [historyFrom, setHistoryFrom]   = useState(sevenDaysAgoIso())
  const [historyTo, setHistoryTo]       = useState(todayIso())
  const [activePeriod, setActivePeriod] = useState<Period | null>(null)
  const didInitialHistoryLoad           = useRef(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getKasaStatus()
      setStatus(s)
      setCloseBalance(s.stav_kasy ?? (s.trzby_dnes + s.pohyby_dnes))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function handleAddMovement(e: React.FormEvent) {
    e.preventDefault()

    if (noteType === 'vybrani' && status) {
      const effectiveBalance = status.stav_kasy ?? (status.trzby_dnes + status.pohyby_dnes)
      const castka = Math.abs(addAmount)
      if (castka > effectiveBalance) {
        setError(`Výběr ${fmtKc(castka)} přesahuje aktuální stav kasy (${fmtKc(effectiveBalance)})`)
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      const finalAmount = noteType === 'vlastni'
        ? addAmount
        : noteType === 'vybrani' ? -Math.abs(addAmount) : Math.abs(addAmount)
      const finalNote = noteType === 'vlastni' ? customNote : noteType === 'vybrani' ? 'výběr' : 'vložení'
      await addKasaMovement(finalAmount, finalNote)
      setAddAmount(0)
      setNoteType('vybrani')
      setCustomNote('')
      setShowAddForm(false)
      setError(null)
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba přidání pohybu')
    } finally {
      setSaving(false)
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await closeKasa(closeBalance, closeNote || undefined)
      setCloseNote('')
      await Promise.all([loadStatus(), loadHistory()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uzavření kasy')
    } finally {
      setSaving(false)
    }
  }

  const loadHistory = useCallback(async (from = historyFrom, to = historyTo) => {
    setError(null)
    try {
      const [c, allMovements] = await Promise.all([
        getKasaClosings(from, to),
        getKasaMovements(undefined, from, to),
      ])
      setClosings(c)
      setMovements(allMovements)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání historie')
    }
  }, [historyFrom, historyTo])

  useEffect(() => {
    if (!didInitialHistoryLoad.current) {
      didInitialHistoryLoad.current = true
      loadHistory()
    }
  }, [loadHistory])

  function selectPeriod(p: Period) {
    const range = periodRange(p)
    setHistoryFrom(range.from)
    setHistoryTo(range.to)
    setActivePeriod(p)
    loadHistory(range.from, range.to)
  }

  if (loading) return <p className={styles.loading}>Načítám…</p>
  if (error && !status) return <p className={styles.error}>{error}</p>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Kasa</h1>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* ── Sekce 1: Dnešní stav ── */}
      {status && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Dnešní stav</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Poslední uzávěrka</div>
              <div className={styles.statValue} data-testid="stat-uzaverka">
                {status.last_closing ? fmtKc(status.last_closing.confirmed_balance) : '?'}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Tržby dnes</div>
              <div className={styles.statValue} data-testid="stat-trzby">
                {fmtKc(status.trzby_dnes)}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Pohyby dnes</div>
              <div className={styles.statValue} data-testid="stat-pohyby">
                {fmtKc(status.pohyby_dnes)}
              </div>
            </div>
            {status.today_closing && (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Dýžko dnes</div>
                <div className={styles.statValue} data-testid="stat-dyzko">
                  {fmtKc(status.today_closing.confirmed_balance - status.today_closing.calculated_balance)}
                </div>
              </div>
            )}
            <div className={`${styles.stat} ${styles.statTotal}`}>
              <div className={styles.statLabel}>Aktuální stav kasy</div>
              <div className={styles.statValue} data-testid="stat-stav">
                {status.stav_kasy !== null
                  ? fmtKc(status.stav_kasy)
                  : `? + ${fmtKc(status.trzby_dnes + status.pohyby_dnes)}`}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Sekce 2: Pohyby dnes ── */}
      {status && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Pohyby dnes</h2>
            <button
              className={styles.addBtn}
              onClick={() => { setError(null); setShowAddForm(true) }}
            >
              + Přidat pohyb
            </button>
          </div>

          {showAddForm && (
            <Modal title="Nový pohyb" onClose={() => { setShowAddForm(false); setAddAmount(0); setNoteType('vybrani'); setCustomNote('') }}>
              <form className={styles.modalForm} onSubmit={handleAddMovement}>
                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.addRow}>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as 'vybrani' | 'vlozeni' | 'vlastni')}
                    className={styles.input}
                  >
                    <option value="vybrani">výběr</option>
                    <option value="vlozeni">vložení</option>
                    <option value="vlastni">vlastní</option>
                  </select>
                  {noteType === 'vlastni' && (
                    <input
                      type="text"
                      placeholder="Vlastní poznámka"
                      value={customNote}
                      onChange={(e) => setCustomNote(e.target.value)}
                      className={styles.input}
                      required
                    />
                  )}
                </div>

                <div className={styles.addRow}>
                  {noteType !== 'vlastni' && (
                    <span className={noteType === 'vybrani' ? styles.signNeg : styles.signPos}>
                      {noteType === 'vybrani' ? '−' : '+'}
                    </span>
                  )}
                  <input
                    type="number"
                    placeholder="Částka"
                    value={addAmount || ''}
                    onChange={(e) => setAddAmount(Number(e.target.value))}
                    className={`${styles.input} ${styles.amountInput}`}
                    required
                    autoFocus
                  />
                </div>

                <div className={styles.formActions}>
                  <button type="submit" disabled={saving} className={styles.saveBtn}>Přidat</button>
                  <button type="button" onClick={() => { setShowAddForm(false); setAddAmount(0); setNoteType('vybrani'); setCustomNote('') }} className={styles.formCancelBtn}>Zrušit</button>
                </div>
              </form>
            </Modal>
          )}

          {status.movements.length === 0 ? (
            <p className={styles.empty}>Žádné pohyby dnes</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Čas</th>
                    <th>Částka</th>
                    <th>Poznámka</th>
                    <th>Uživatel</th>
                  </tr>
                </thead>
                <tbody>
                  {status.movements.map((m) => (
                    <tr key={m.id}>
                      <td className={styles.tdTime}>{fmtTime(m.created_at)}</td>
                      <td className={m.amount >= 0 ? styles.pos : styles.neg}>
                        {m.amount >= 0 ? '+' : ''}{fmtKc(m.amount)}
                      </td>
                      <td>{m.note}</td>
                      <td className={styles.tdDim}>{m.created_by_username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Sekce 3: Uzavření dne ── */}
      {status && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Uzavření dne</h2>
          <form className={styles.closeForm} onSubmit={handleClose}>
            <label className={styles.formLabel}>Potvrzený zůstatek (Kč)</label>
            <input
              type="number"
              data-testid="close-balance-input"
              value={closeBalance}
              onChange={(e) => setCloseBalance(Number(e.target.value))}
              className={styles.input}
              required
            />
            <input
              type="text"
              placeholder="Poznámka k uzávěrce (nepovinná)"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className={styles.input}
            />
            <button type="submit" disabled={saving} className={styles.closeBtn}>
              Uzavřít den
            </button>
          </form>
        </section>
      )}

      {/* ── Sekce 4: Historie ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Historie</h2>
        <div className={styles.historyFilter}>
          {([{ key: 'month', label: 'Tento měsíc' }, { key: 'lastmonth', label: 'Minulý měsíc' }] as { key: Period; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.periodBtn}${activePeriod === key ? ' ' + styles.active : ''}`}
              onClick={() => selectPeriod(key)}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            value={historyFrom}
            onChange={(e) => { setHistoryFrom(e.target.value); setActivePeriod(null) }}
            className={styles.dateInput}
          />
          <span className={styles.filterLabel}>–</span>
          <input
            type="date"
            value={historyTo}
            onChange={(e) => { setHistoryTo(e.target.value); setActivePeriod(null) }}
            className={styles.dateInput}
          />
          <button onClick={() => loadHistory()} className={styles.applyBtn}>
            Zobrazit
          </button>
        </div>

        {closings.length === 0 && movements.length === 0 && (
          <p className={styles.empty}>Klikněte na Načíst pro zobrazení historie</p>
        )}

        {closings.length > 0 && (
          <>
            <h3 className={styles.subTitle}>Uzávěrky</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th className={styles.tdNum}>Potvrzený zůstatek</th>
                    <th className={styles.tdNum}>Vypočítaný zůstatek</th>
                    <th className={styles.tdNum}>Dýžko</th>
                    <th>Poznámka</th>
                    <th>Uživatel</th>
                  </tr>
                </thead>
                <tbody>
                  {closings.map((c) => (
                    <tr key={c.id}>
                      <td>{fmtDate(c.date)}</td>
                      <td className={`${styles.pos} ${styles.tdNum}`}>{fmtKc(c.confirmed_balance)}</td>
                      <td className={`${styles.tdDim} ${styles.tdNum}`}>{fmtKc(c.calculated_balance)}</td>
                      <td className={`${c.confirmed_balance - c.calculated_balance >= 0 ? styles.pos : styles.neg} ${styles.tdNum}`}>
                        {fmtKc(c.confirmed_balance - c.calculated_balance)}
                      </td>
                      <td>{c.note ?? '—'}</td>
                      <td className={styles.tdDim}>{c.created_by_username}</td>
                    </tr>
                  ))}
                </tbody>
                {closings.length > 1 && (() => {
                  const sumConfirmed   = closings.reduce((s, c) => s + c.confirmed_balance, 0)
                  const sumCalculated  = closings.reduce((s, c) => s + c.calculated_balance, 0)
                  const sumDyzko       = sumConfirmed - sumCalculated
                  return (
                    <tfoot>
                      <tr className={styles.summaryRow}>
                        <td>Celkem</td>
                        <td className={`${styles.pos} ${styles.tdNum}`}>{fmtKc(sumConfirmed)}</td>
                        <td className={`${styles.tdDim} ${styles.tdNum}`}>{fmtKc(sumCalculated)}</td>
                        <td className={`${sumDyzko >= 0 ? styles.pos : styles.neg} ${styles.tdNum}`}>{fmtKc(sumDyzko)}</td>
                        <td /><td />
                      </tr>
                    </tfoot>
                  )
                })()}
              </table>
            </div>
          </>
        )}

        {movements.length > 0 && (
          <>
            <h3 className={styles.subTitle}>Pohyby</h3>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Čas</th>
                    <th>Částka</th>
                    <th>Poznámka</th>
                    <th>Uživatel</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.date)}</td>
                      <td className={styles.tdTime}>{fmtTime(m.created_at)}</td>
                      <td className={m.amount >= 0 ? styles.pos : styles.neg}>
                        {m.amount >= 0 ? '+' : ''}{fmtKc(m.amount)}
                      </td>
                      <td>{m.note}</td>
                      <td className={styles.tdDim}>{m.created_by_username}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
