// frontend/src/components/pos/BagSelector.tsx
import { POSStep } from '../../hooks/usePOS'
import styles from './BagSelector.module.css'

interface Props {
  step: POSStep
  wantBag: boolean
  materials: string[]
  materialIndex: number
  volumes: number[]
  volumeIndex: number
  onToggleWantBag: () => void
}

export default function BagSelector({ step, wantBag, materials, materialIndex, volumes, volumeIndex, onToggleWantBag }: Props) {
  if (step === 'bag_yn') {
    return (
      <div className={styles.container}>
        <p className={styles.title}>Chce pytlík?</p>
        <ul className={styles.list}>
          <li className={`${styles.item} ${wantBag ? styles.active : ''}`} onClick={onToggleWantBag}>Ano</li>
          <li className={`${styles.item} ${!wantBag ? styles.active : ''}`} onClick={onToggleWantBag}>Ne</li>
        </ul>
      </div>
    )
  }

  if (step === 'bag_material') {
    return (
      <div className={styles.container}>
        <p className={styles.title}>Materiál pytlíku</p>
        <ul className={styles.list}>
          {materials.map((m, i) => (
            <li key={m} className={`${styles.item} ${i === materialIndex ? styles.active : ''}`}>
              {m}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (step === 'bag_volume') {
    return (
      <div className={styles.container}>
        <p className={styles.title}>Objem pytlíku</p>
        <ul className={styles.list}>
          {volumes.map((v, i) => (
            <li key={v} className={`${styles.item} ${i === volumeIndex ? styles.active : ''}`}>
              {v} ml
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
}
