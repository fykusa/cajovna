// frontend/src/components/pos-mobile/MobileActionBar.tsx
import styles from './MobileActionBar.module.css'

interface Props {
  primary?: { label: string; onClick: () => void; disabled?: boolean }
  secondary?: { label: string; onClick: () => void }
}

export default function MobileActionBar({ primary, secondary }: Props) {
  return (
    <div className={styles.bar}>
      {secondary && (
        <button className={styles.secondary} onClick={secondary.onClick}>
          {secondary.label}
        </button>
      )}
      {primary && (
        <button className={styles.primary} onClick={primary.onClick} disabled={primary.disabled}>
          {primary.label}
        </button>
      )}
    </div>
  )
}
