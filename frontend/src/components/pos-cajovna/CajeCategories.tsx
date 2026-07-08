import type { TeaRow } from '../../types'
import CajeTeas from './CajeTeas'
import styles from './CajeCategories.module.css'

interface Props {
  categories: string[]
  onSelect: (kategorie: string) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  searchResults: TeaRow[]
  onSelectTea: (tea: TeaRow) => void
}

export default function CajeCategories({
  categories, onSelect, searchQuery, onSearchChange, searchResults, onSelectTea,
}: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.searchBar}>
        <input
          className={styles.search}
          type="text"
          placeholder="Hledat podle názvu…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      {searchQuery.length === 0 ? (
        <div className={styles.scroll}>
          <div className={styles.grid}>
            {categories.map((kategorie) => (
              <button
                key={kategorie}
                className={styles.card}
                onClick={() => onSelect(kategorie)}
              >
                <span className={styles.name}>{kategorie}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <CajeTeas teas={searchResults} categoryName="" onSelect={onSelectTea} emptyMessage="Nic nenalezeno" />
      )}
    </div>
  )
}
