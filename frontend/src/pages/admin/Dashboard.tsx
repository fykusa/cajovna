// frontend/src/pages/admin/Dashboard.tsx
import { useEffect, useState } from 'react'
import { getSales } from '../../api/sales'
import type { Sale } from '../../types'

export default function AdminDashboard() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    getSales({ from: today + ' 00:00:00', to: today + ' 23:59:59' })
      .then(setSales)
      .catch((e) => setError(e instanceof Error ? e.message : 'Chyba načítání'))
      .finally(() => setLoading(false))
  }, [])

  const total = sales.reduce((s, sale) => s + Number(sale.total_amount), 0)

  return (
    <div>
      <h1 style={{ marginBottom: 24, color: '#d4a84b' }}>Přehled — dnes</h1>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {loading ? (
        <p style={{ color: '#aaa' }}>Načítám…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 24, marginBottom: 32 }}>
            <Stat label="Počet prodejů" value={String(sales.length)} />
            <Stat label="Tržby celkem" value={`${Math.round(total)} Kč`} />
          </div>
          <h2 style={{ marginBottom: 12, fontSize: '1rem', color: '#aaa' }}>Poslední prodeje</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#888', textAlign: 'left', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '8px' }}>Čas</th>
                <th style={{ padding: '8px' }}>Prodavačka</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Částka</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                    {new Date(s.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '8px' }}>{s.username}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#6abf69', fontWeight: 600 }}>
                    {Math.round(Number(s.total_amount))} Kč
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && <p style={{ color: '#555', fontStyle: 'italic' }}>Dnes zatím žádné prodeje.</p>}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#2a2a2a', padding: '20px 28px', borderRadius: 8 }}>
      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#d4a84b' }}>{value}</div>
    </div>
  )
}
