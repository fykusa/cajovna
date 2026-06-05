import { useState, useEffect } from 'react'
import type { Tea } from '../../types'
import styles from './QuantityModal.module.css'

interface Props {
  tea: Tea | null
  quantity: number
  onQuantityChange: (value: number) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function QuantityModal({
  tea,
  quantity,
  onQuantityChange,
  onConfirm,
  onCancel,
}: Props) {
  const [raw, setRaw] = useState(String(quantity))

  useEffect(() => {
    setRaw(String(quantity))
  }, [quantity])

  if (!tea) return null

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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const str = e.target.value
    setRaw(str)
    const v = parseInt(str, 10)
    if (!isNaN(v) && v >= 1) onQuantityChange(v)
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{tea.name}</h2>
        <div className={styles.content}>
          <label className={styles.label}>Množství:</label>
          <input
            type="number"
            min={1}
            value={raw}
            onChange={handleChange}
            onBlur={() => {
              if (parseInt(raw, 10) < 1 || isNaN(parseInt(raw, 10))) setRaw(String(quantity))
            }}
            className={styles.input}
            autoFocus
          />
        </div>

        {baleni.length > 0 && (
          <div className={styles.variants}>
            <div className={styles.variantLabel}>Dostupné balení:</div>
            <ul>
              {baleni.map((b) => (
                <li key={b.label}>
                  {b.label}: {b.weight}g — {b.price} Kč
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.buttons}>
          <button className={styles.confirm} onClick={onConfirm}>
            Pokračovat (ENTER)
          </button>
          <button className={styles.cancel} onClick={onCancel}>
            Zrušit (ESC)
          </button>
        </div>
      </div>
    </div>
  )
}
