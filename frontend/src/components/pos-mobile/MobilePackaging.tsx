// frontend/src/components/pos-mobile/MobilePackaging.tsx
import type { PackagingOption } from '../../hooks/posHelpers'
import styles from './MobilePackaging.module.css'

interface Props {
  options: PackagingOption[]
  selected: PackagingOption | null
  onSelect: (pkg: PackagingOption) => void
}

export default function MobilePackaging({ options, selected, onSelect }: Props) {
  return (
    <div className={styles.scroll}>
      <ul className={styles.list}>
        {options.map((pkg) => (
          <li key={pkg.type}>
            <button
              className={`${styles.row} ${selected?.type === pkg.type ? styles.active : ''}`}
              onClick={() => onSelect(pkg)}
            >
              <div className={styles.info}>
                <span className={styles.label}>{pkg.label}</span>
                <span className={styles.weight}>{pkg.weightG} g</span>
              </div>
              <span className={styles.price}>{pkg.price} Kč</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
