// frontend/src/components/pos/HistoryPanel.tsx
import { useRef, useEffect } from 'react'
import type { Sale, SaleItem } from '../../types'
import styles from './HistoryPanel.module.css'

interface Props {
  sales: Sale[]
  saleItemsByIndex: Record<number, SaleItem[]>
  selectedIndex: number
  onSelect: (sale: Sale, index: number) => void
  isActive: boolean
}

function calculatePrices(items: SaleItem[]) {
  let goodsPrice = 0
  let bagPrice = 0

  for (const item of items) {
    if (item.item_type === 'bag') {
      bagPrice += item.total_price
    } else {
      goodsPrice += item.total_price
    }
  }

  return { goodsPrice, bagPrice }
}

export default function HistoryPanel({
  sales,
  saleItemsByIndex,
  selectedIndex,
  onSelect,
  isActive,
}: Props) {
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive) return

    const frame = requestAnimationFrame(() => {
      if (!tableRef.current) return
      const selectedRow = tableRef.current.querySelector(
        `[data-testid="history-row"][data-index="${selectedIndex}"]`
      ) as HTMLElement | undefined
      if (selectedRow && typeof selectedRow.scrollIntoView === 'function') {
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedIndex, isActive])

  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colId}>ID</th>
            <th className={styles.colTime}>Čas</th>
            <th className={styles.colUser}>Prodavající</th>
            <th className={styles.colGoods}>Cena za zboží</th>
            <th className={styles.colBag}>Cena za pytlíky</th>
            <th className={styles.colTotal}>Celková</th>
          </tr>
        </thead>
      </table>

      <div className={styles.tableBody} ref={tableRef}>
        {sales.map((sale, idx) => {
          const items = saleItemsByIndex[sale.id] || []
          const { goodsPrice, bagPrice } = calculatePrices(items)

          return (
            <div
              key={sale.id}
              data-testid="history-row"
              data-index={idx}
              className={`${styles.row} ${idx === selectedIndex ? styles.selected : ''}`}
              onClick={() => onSelect(sale, idx)}
            >
              <div className={styles.colId} data-testid="col-id">{sale.id}</div>
              <div className={styles.colTime} data-testid="col-time">
                {new Date(sale.created_at).toLocaleTimeString('cs-CZ', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div className={styles.colUser} data-testid="col-user">{sale.username}</div>
              <div className={styles.colGoods} data-testid="col-goods">{goodsPrice} Kč</div>
              <div className={styles.colBag} data-testid="col-bag">{bagPrice} Kč</div>
              <div className={styles.colTotal} data-testid="col-total">{Math.round(sale.total_amount)} Kč</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
