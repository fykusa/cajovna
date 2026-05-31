import { useEffect, useState } from 'react'
import type { Bag } from '../../types'
import { getBags } from '../../api/bags'
import styles from './Bags.module.css'

export default function Bags() {
  const [bags, setBags] = useState<Bag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBags().then(setBags).finally(() => setLoading(false))
  }, [])

  const grouped: Record<string, Bag[]> = {}
  bags.forEach((b) => {
    if (!grouped[b.surface_type]) grouped[b.surface_type] = []
    grouped[b.surface_type].push(b)
  })

  return (
    <div>
      <h1 className={styles.title}>Pytlíky — ceník</h1>
      {loading ? (
        <p className={styles.loading}>Načítám…</p>
      ) : (
        Object.entries(grouped).map(([material, items]) => (
          <div key={material} className={styles.group}>
            <h2 className={styles.material}>{material}</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Objem</th>
                  <th>Rozměry</th>
                  <th>Cena / ks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((bag) => (
                  <tr key={bag.id}>
                    <td>{bag.volume_ml} ml</td>
                    <td className={styles.dim}>{bag.dimensions ?? '—'}</td>
                    <td className={styles.price}>
                      {Number(bag.price_per_piece).toLocaleString('cs-CZ', {
                        minimumFractionDigits: 2, maximumFractionDigits: 2
                      })} Kč
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
