import type { Tea } from '../../types'
import type { PackagingOption, BagListItem } from '../../hooks/usePOS'
import styles from './ConfigurePanel.module.css'

interface Props {
  tea: Tea
  packagingOptions: PackagingOption[]
  packagingIndex: number
  quantity: number
  bagList: BagListItem[]
  bagIndex: number
  activePanel: 'packaging' | 'quantity' | 'bag'
}

export default function ConfigurePanel({
  packagingOptions,
  packagingIndex,
  quantity,
  bagList,
  bagIndex,
  activePanel,
}: Props) {
  return (
    <div className={styles.container}>
      {/* Balení */}
      <div
        className={`${styles.section} ${activePanel === 'packaging' ? styles.active : ''}`}
        data-panel="packaging"
      >
        <div className={styles.header}>Balení</div>
        <ul className={styles.list}>
          {packagingOptions.map((opt, i) => (
            <li
              key={opt.type}
              className={`${styles.item} ${i === packagingIndex ? styles.selected : ''}`}
            >
              <span>{opt.label}</span>
              <span>{opt.price} Kč</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Množství */}
      <div
        className={`${styles.section} ${activePanel === 'quantity' ? styles.active : ''}`}
        data-panel="quantity"
      >
        <div className={styles.header}>Množství</div>
        <div className={styles.quantityDisplay}>
          <div className={styles.quantityValue}>{quantity}</div>
          <div className={styles.quantityHint}>↑↓ šipky</div>
        </div>
      </div>

      {/* Pytlík */}
      <div
        className={`${styles.section} ${activePanel === 'bag' ? styles.active : ''}`}
        data-panel="bag"
      >
        <div className={styles.header}>Obal</div>
        <ul className={styles.list}>
          {bagList.map((item, i) => (
            <li
              key={i}
              className={`${styles.item} ${i === bagIndex ? styles.selected : ''}`}
            >
              <span>{item.label}</span>
              {item.bag && <span className={styles.bagPrice}>{item.bag.price_per_piece} Kč</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
