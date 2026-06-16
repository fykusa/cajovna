import { useState, useEffect, useCallback, useRef } from 'react'
import type { KasaStatus, CashMovement, CashClosing } from '../../types'
import {
  getKasaStatus,
  addKasaMovement,
  getKasaMovements,
  closeKasa,
  getKasaClosings,
} from '../../api/kasa'
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

function thirtyDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

export default function Kasa() {
  const [status, setStatus]             = useState<KasaStatus | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [showAddForm, setShowAddForm]   = useState(false)
  const [addAmount, setAddAmount]       = useState(0)
  const [addNote, setAddNote]           = useState('')
  const [saving, setSaving]             = useState(false)
  const [closeBalance, setCloseBalance] = useState(0)
  const [closeNote, setCloseNote]       = useState('')
  const [closings, setClosings]         = useState<CashClosing[]>([])
  const [movements, setMovements]       = useState<CashMovement[]>([])
  const [historyFrom, setHistoryFrom]   = useState(thirtyDaysAgoIso())
  const [historyTo, setHistoryTo]       = useState(todayIso())
  const hasInitializedClose             = useRef(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await getKasaStatus()
      setStatus(s)
      if (!hasInitializedClose.current) {
        setCloseBalance(s.stav_kasy ?? 0)
        hasInitializedClose.current = true
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  async function handleAddMovement(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await addKasaMovement(addAmount, addNote)
      setAddAmount(0)
      setAddNote('')
      setShowAddForm(false)
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
      await loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba uzavření kasy')
    } finally {
      setSaving(false)
    }
  }

  async function loadHistory() {
    setError(null)
    try {
      const [c, allMovements] = await Promise.all([
        getKasaClosings(historyFrom, historyTo),
        getKasaMovements(),
      ])
      const filtered = allMovements.filter(m => {
        return (!historyFrom || m.date >= historyFrom) && (!historyTo || m.date <= historyTo)
      })
      setClosings(c)
      setMovements(filtered)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba načítání historie')
    }
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
              <div className={styles.statLabel}>Uzávěrka předchozí den</div>
              <div className={styles.statValue} data-testid="stat-uzaverka">
                {status.last_closing ? fmtKc(status.last_closing.confirmed_balance) : '—'}
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
            <div className={`${styles.stat} ${styles.statTotal}`}>
              <div className={styles.statLabel}>Aktuální stav kasy</div>
              <div className={styles.statValue} data-testid="stat-stav">
                {status.stav_kasy !== null
                  ? fmtKc(status.stav_kasy)
                  : `— + ${fmtKc(status.trzby_dnes + status.pohyby_dnes)}`}
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
              className={styles.toggleBtn}
              onClick={() => setShowAddForm((p) => !p)}
            >
              {showAddForm ? 'Zrušit' : '+ Přidat pohyb'}
            </button>
          </div>

          {showAddForm && (
            <form className={styles.addForm} onSubmit={handleAddMovement}>
              <input
                type="number"
                placeholder="Částka (Kč)"
                value={addAmount}
                onChange={(e) => setAddAmount(Number(e.target.value))}
                className={styles.input}
                required
              />
              <input
                type="text"
                placeholder="Poznámka pohybu"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                className={styles.input}
                required
              />
              <button type="submit" disabled={saving} className={styles.saveBtn}>
                Přidat
              </button>
            </form>
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
          <span className={styles.filterLabel}>Od</span>
          <input
            type="date"
            value={historyFrom}
            onChange={(e) => setHistoryFrom(e.target.value)}
            className={styles.dateInput}
          />
          <span className={styles.filterLabel}>Do</span>
          <input
            type="date"
            value={historyTo}
            onChange={(e) => setHistoryTo(e.target.value)}
            className={styles.dateInput}
          />
          <button onClick={loadHistory} className={styles.applyBtn}>
            Načíst
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
                    <th>Potvrzený zůstatek</th>
                    <th>Vypočítaný zůstatek</th>
                    <th>Poznámka</th>
                  </tr>
                </thead>
                <tbody>
                  {closings.map((c) => (
                    <tr key={c.id}>
                      <td>{fmtDate(c.date)}</td>
                      <td className={styles.pos}>{fmtKc(c.confirmed_balance)}</td>
                      <td className={styles.tdDim}>{fmtKc(c.calculated_balance)}</td>
                      <td>{c.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
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
