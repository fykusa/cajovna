import { fmtKc } from '../../pages/admin/format'
import styles from './HBarChart.module.css'

interface Bar {
  label: string
  value: number
}

interface Props {
  data: Bar[]
  valueHeader?: string
}

// Horizontální sloupcový graf — bary běží zleva doprava, číslo zarovnané vpravo.
// Výšky hlavičky/řádků odpovídají .table z admin stylů, aby graf lícoval se
// sousední tabulkou (stejné pořadí dat = stejné řádky).
export default function HBarChart({ data, valueHeader = 'Tržba' }: Props) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className={styles.chart}>
      <div className={styles.headRow}>
        <span className={styles.value}>{valueHeader}</span>
      </div>
      {data.map((d) => (
        <div key={d.label} className={styles.row} title={`${d.label}: ${fmtKc(d.value)}`}>
          <div className={styles.track}>
            <div className={styles.bar} style={{ width: `${Math.max((d.value / max) * 100, 2)}%` }} />
          </div>
          <span className={styles.value}>{fmtKc(d.value)}</span>
        </div>
      ))}
    </div>
  )
}
