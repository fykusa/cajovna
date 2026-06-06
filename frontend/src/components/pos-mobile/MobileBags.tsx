// frontend/src/components/pos-mobile/MobileBags.tsx
import type { Bag } from '../../types'
import type { BagListItem } from '../../hooks/posHelpers'
import { bagUnitPrice } from '../pos/cartTotals'
import styles from './MobileBags.module.css'

interface Props {
  bagList: BagListItem[]
  onSelect: (bag: Bag | null) => void
}

const SECTION_ORDER = ['papír', 'matný', 'transparentní', 'ostatní']
const SECTION_LABELS: Record<string, string> = {
  'papír': 'Papír',
  'matný': 'Matný',
  'transparentní': 'Transparentní',
  'ostatní': 'Ostatní',
}

function sectionKey(surfaceType: string): string {
  const s = surfaceType.toLowerCase()
  if (s.includes('papír') || s.includes('papir')) return 'papír'
  if (s.includes('mat')) return 'matný'
  if (s.includes('transpar')) return 'transparentní'
  return 'ostatní'
}

export default function MobileBags({ bagList, onSelect }: Props) {
  const noBag = bagList.find(i => i.bag === null)
  const realItems = bagList.filter(i => i.bag !== null)

  const sections: Record<string, BagListItem[]> = {}
  for (const item of realItems) {
    const key = sectionKey(item.bag!.surface_type)
    if (!sections[key]) sections[key] = []
    sections[key].push(item)
  }

  const activeSections = SECTION_ORDER.filter(k => sections[k]?.length)

  return (
    <div className={styles.scroll}>
      {noBag && (
        <button className={`${styles.btn} ${styles.noBagBtn}`} onClick={() => onSelect(null)}>
          Žádný
        </button>
      )}
      {activeSections.map(key => (
        <div key={key} className={styles.section}>
          <div className={styles.sectionLabel}>{SECTION_LABELS[key]}</div>
          <div className={styles.grid}>
            {sections[key].map((item, i) => {
              const bag = item.bag!
              const price = bagUnitPrice(bag)
              return (
                <button key={i} className={styles.btn} onClick={() => onSelect(bag)}>
                  <span className={styles.vol}>{bag.volume_ml} ml</span>
                  <span className={styles.price}>{price} Kč</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
