import { useState } from 'react'
import type { CajeBaleni } from '../../types'
import styles from './CajeConfirmPrice.module.css'

interface Props {
  teaName: string
  baleni: CajeBaleni
  kusu: number
  onConfirm: (celkCena: number) => void
}

export default function CajeConfirmPrice({ teaName, baleni, kusu, onConfirm }: Props) {
  const defaultCena = baleni.cena * kusu
  const [cena, setCena] = useState(String(defaultCena))
  const cenaValid = cena.trim() !== '' && Number(cena) >= 0

  return (
    <>
      <div className={styles.scroll}>
        <p className={styles.hint}>{teaName} · {baleni.label} {baleni.mn} g · {kusu}× {baleni.cena} Kč/ks</p>
        <div className={styles.totalRow}>
          <span>Cena celkem</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            className={styles.cenaInput}
            aria-label="Cena položky"
            value={cena}
            onChange={(e) => setCena(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <span className={styles.currency}>Kč</span>
        </div>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.confirmBtn}
          onClick={() => onConfirm(Number(cena))}
          disabled={!cenaValid}
        >
          Vložit do košíku
        </button>
      </div>
    </>
  )
}
