import type { CajeView } from '../../hooks/useCajovnaPOS'
import styles from './CajeProgressBar.module.css'

const STEPS: CajeView[] = ['categories', 'teas', 'packaging', 'quantity', 'checkout']

interface Props { view: CajeView }

export default function CajeProgressBar({ view }: Props) {
  const activeIdx = STEPS.indexOf(view)
  if (activeIdx < 0) return null
  return (
    <div className={styles.bar}>
      {STEPS.map((step, i) => (
        <div
          key={step}
          className={`${styles.dot} ${i <= activeIdx ? styles.active : ''}`}
        />
      ))}
    </div>
  )
}
