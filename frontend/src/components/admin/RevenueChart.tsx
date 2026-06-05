import styles from './RevenueChart.module.css'

interface Bucket {
  label: string
  value: number
}

interface Props {
  data: Bucket[]
  title?: string
}

const fmtKc = (n: number) => Math.round(n).toLocaleString('cs-CZ')

export default function RevenueChart({ data, title = 'Tržby v čase' }: Props) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const total = data.reduce((s, d) => s + d.value, 0)
  // Zředění popisků osy X, ať se u dlouhých období nepřekrývají (~12 popisků).
  const step = Math.max(1, Math.ceil(data.length / 12))

  return (
    <div className={styles.chart}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.total}>{fmtKc(total)} Kč</span>
      </div>
      {data.length === 0 ? (
        <div className={styles.empty}>Žádná data</div>
      ) : (
        <div className={styles.plot}>
          {data.map((d, i) => (
            <div key={i} className={styles.col} title={`${d.label}: ${fmtKc(d.value)} Kč`}>
              <div className={styles.barWrap}>
                <div
                  className={`${styles.bar}${d.value === 0 ? ' ' + styles.barZero : ''}`}
                  style={{ height: `${(d.value / max) * 100}%` }}
                >
                  {d.value > 0 && <span className={styles.barValue}>{fmtKc(d.value)}</span>}
                </div>
              </div>
              <span className={styles.xlabel}>{i % step === 0 ? d.label : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
