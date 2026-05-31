// frontend/src/components/pos/QuantitySelector.tsx
import { useState, useEffect } from 'react'
import type { ChangeEvent } from 'react'
import type { Tea } from '../../types'
import styles from './QuantitySelector.module.css'

interface Props {
  tea: Tea
  quantity: number
  onChange: (value: number) => void
}

export default function QuantitySelector({ tea, quantity, onChange }: Props) {
  const [raw, setRaw] = useState(String(quantity))

  useEffect(() => {
    setRaw(String(quantity))
  }, [quantity])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const str = e.target.value
    setRaw(str)
    const v = parseInt(str, 10)
    if (!isNaN(v) && v >= 1) onChange(v)
  }

  const baleni = [
    tea.std_weight_g && tea.std_price_moc
      ? { label: 'Std', weight: tea.std_weight_g, price: tea.std_price_moc }
      : null,
    tea.pkg1_weight_g && tea.pkg1_price_moc
      ? { label: 'Bal 1', weight: tea.pkg1_weight_g, price: tea.pkg1_price_moc }
      : null,
    tea.pkg2_weight_g && tea.pkg2_price_moc
      ? { label: 'Bal 2', weight: tea.pkg2_weight_g, price: tea.pkg2_price_moc }
      : null,
  ].filter(Boolean) as { label: string; weight: number; price: number }[]

  return (
    <div className={styles.container}>
      <h2 className={styles.teaName}>{tea.name}</h2>
      <div className={styles.row}>
        <label className={styles.label}>Množství:</label>
        <input
          type="number"
          min={1}
          value={raw}
          onChange={handleChange}
          onBlur={() => { if (parseInt(raw, 10) < 1 || isNaN(parseInt(raw, 10))) setRaw(String(quantity)) }}
          className={styles.input}
          autoFocus
        />
      </div>
      {baleni.length > 0 && (
        <ul className={styles.variants}>
          {baleni.map((b) => (
            <li key={b.label} className={styles.variant}>
              {b.label}: {b.weight} g — {b.price} Kč
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
