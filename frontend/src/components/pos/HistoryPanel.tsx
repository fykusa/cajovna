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
    const price = Number(item.total_price) || 0
    if (item.item_type === 'bag') {
      bagPrice += price
    } else {
      goodsPrice += price
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
      <div className={styles.tableHeader}>
        <div className={styles.row}>
          <div className={styles.colId}>ID</div>
          <div className={styles.colTime}>Čas</div>
          <div className={styles.colUser}>Prodavající</div>
          <div className={styles.colBag}>Cena za pytlíky</div>
          <div className={styles.colGoods}>Cena za zboží</div>
          <div className={styles.colTotal}>Celková</div>
        </div>
      </div>

      <div className={styles.tableBody} ref={tableRef}>
        {sales.map((sale, idx) => {
          const items = saleItemsByIndex[sale.id] || []
          const { goodsPrice, bagPrice } = calculatePrices(items)

          const goodsPriceNum = Math.round(Number(goodsPrice) || 0)
          const bagPriceNum = Math.round(Number(bagPrice) || 0)
          const totalNum = Math.round(Number(sale.total_amount) || 0)

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
              {bagPriceNum > 0 && (
                <div className={styles.colBag} data-testid="col-bag">
                  {bagPriceNum} Kč
                </div>
              )}
              {bagPriceNum > 0 && goodsPriceNum > 0 && (
                <div className={styles.colGoods} data-testid="col-goods">
                  {goodsPriceNum} Kč
                </div>
              )}
              <div className={styles.colTotal} data-testid="col-total">
                {totalNum} Kč
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
