// frontend/src/components/pos-mobile/MobileProgressBar.tsx
import type { MobileView } from '../../hooks/useMobilePOS'
import styles from './MobileProgressBar.module.css'

const STEPS: MobileView[] = ['categories', 'teas', 'packaging', 'quantity', 'bags']

interface Props { view: MobileView }

export default function MobileProgressBar({ view }: Props) {
  const currentIdx = STEPS.indexOf(view)
  if (currentIdx === -1) return null
  return (
    <div className={styles.bar}>
      {STEPS.map((step, i) => (
        <div
          key={step}
          className={`${styles.seg} ${i < currentIdx ? styles.done : ''} ${i === currentIdx ? styles.active : ''}`}
        />
      ))}
    </div>
  )
}
