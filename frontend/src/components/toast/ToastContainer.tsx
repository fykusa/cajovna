import { createPortal } from 'react-dom'
import type { Toast } from './ToastProvider'
import styles from './Toast.module.css'

interface Props {
  toasts: Toast[]
  onClose: (id: number) => void
}

export default function ToastContainer({ toasts, onClose }: Props) {
  if (toasts.length === 0) return null

  return createPortal(
    <div className={styles.container}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.type === 'success' ? styles.success : styles.error}`}
          role="alert"
        >
          <span className={styles.message}>{t.message}</span>
          <button
            className={styles.close}
            onClick={() => onClose(t.id)}
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
