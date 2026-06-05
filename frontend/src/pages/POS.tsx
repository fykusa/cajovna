import { useEffect, useCallback, useState } from 'react'
import { usePOS } from '../hooks/usePOS'
import { useAuthStore } from '../store/authStore'
import { getSales } from '../api/sales'
import CategoryList from '../components/pos/CategoryList'
import TeaList from '../components/pos/TeaList'
import SearchResults from '../components/pos/SearchResults'
import QuantitySelector from '../components/pos/QuantitySelector'
import BagSelector from '../components/pos/BagSelector'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import { useToast } from '../components/toast/useToast'
import type { Sale } from '../types'
import styles from './POS.module.css'

export default function POS() {
  const { state, moveUp, moveDown, confirm, setQuantity,
          startSearch, appendSearch, cancelItem, removeFromCart, clearCart } = usePOS()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [showCheckout, setShowCheckout] = useState(false)
  const toast = useToast()

  const [posMode, setPosMode] = useState<'sell' | 'history'>('sell')
  const [history, setHistory] = useState<Sale[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const handleSpace = useCallback(() => {
    if (state.step !== 'category') return
    setPosMode((prev) => (prev === 'sell' ? 'history' : 'sell'))
  }, [state.step])

  const handleHistoryNavigation = useCallback(
    (direction: 'up' | 'down') => {
      if (posMode !== 'history' || history.length === 0) return
      const newIndex = direction === 'up'
        ? (historyIndex - 1 + history.length) % history.length
        : (historyIndex + 1) % history.length
      setHistoryIndex(newIndex)
      setSelectedSale(history[newIndex])
    },
    [posMode, history, historyIndex],
  )

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirm()
      return
    }

    // Escape = zruš rozpracovanou položku (funguje i ve kroku quantity, kde je focus v inputu)
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelItem()
      return
    }

    // SPACE = přepínání mezi módy
    if (e.key === ' ') {
      e.preventDefault()
      handleSpace()
      return
    }

    if ((e.target as HTMLElement).tagName === 'INPUT') return

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        if (posMode === 'history') {
          handleHistoryNavigation('up')
        } else {
          moveUp()
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (posMode === 'history') {
          handleHistoryNavigation('down')
        } else {
          moveDown()
        }
        break
      case 'F10':
        if (state.cart.length > 0) { e.preventDefault(); setShowCheckout(true) }
        break
      case 'Backspace':
        if (state.step === 'search' && state.searchQuery.length > 0) {
          startSearch(state.searchQuery.slice(0, -1))
        }
        break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (state.step === 'category' || state.step === 'tea') {
            startSearch(e.key)
          } else if (state.step === 'search') {
            appendSearch(e.key)
          }
        }
    }
  }, [state, moveUp, moveDown, confirm, startSearch, appendSearch, cancelItem, posMode, handleSpace, handleHistoryNavigation])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Načteme dnešní prodeje na mount
  useEffect(() => {
    const today = new Date()
    const dateFrom = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const dateTo = new Date(dateFrom.getTime() + 24 * 60 * 60 * 1000 - 1)

    getSales({
      date_from: dateFrom.toISOString().split('T')[0],
      date_to: dateTo.toISOString().split('T')[0],
    })
      .then((sales) => {
        setHistory(sales)
        setHistoryLoading(false)
      })
      .catch((e) => {
        setHistoryError(e instanceof Error ? e.message : 'Chyba při načítání')
        setHistoryLoading(false)
      })
  }, [])

  function renderMainPanel() {
    if (state.step === 'search') {
      return (
        <SearchResults
          query={state.searchQuery}
          results={state.searchResults}
          activeIndex={state.searchIndex}
          onSelect={() => confirm()}
        />
      )
    }
    if (state.step === 'tea') {
      return (
        <TeaList
          teas={state.teas}
          activeIndex={state.teaIndex}
          onSelect={() => {}}
        />
      )
    }
    if (state.step === 'quantity' && state.selectedTea) {
      return (
        <QuantitySelector
          tea={state.selectedTea}
          quantity={state.quantity}
          onChange={setQuantity}
        />
      )
    }
    if (state.step === 'bag_yn' || state.step === 'bag_material' || state.step === 'bag_volume') {
      return (
        <BagSelector
          step={state.step}
          wantBag={state.wantBag}
          materials={state.bagMaterials}
          materialIndex={state.materialIndex}
          volumes={state.bagVolumes}
          volumeIndex={state.volumeIndex}
          onToggleWantBag={() => moveDown()}
        />
      )
    }
    return (
      <CategoryList
        categories={state.categories}
        activeIndex={state.categoryIndex}
        onSelect={() => {}}
      />
    )
  }

  if (state.loading) return <div className={styles.loading}>Načítám data…</div>
  if (state.error) return <div className={styles.error}>Chyba: {state.error}</div>

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <span className={styles.username}>{user?.username}</span>
        <span className={styles.step}>Krok: {state.step}</span>
        <button onClick={logout} className={styles.logoutBtn}>Odhlásit</button>
      </header>

      <main className={styles.main}>
        <section className={styles.panel}>
          {renderMainPanel()}
        </section>

        <aside className={styles.cartPanel}>
          <Cart
            items={state.cart}
            onRemove={removeFromCart}
            onCheckout={() => setShowCheckout(true)}
          />
        </aside>
      </main>

      {showCheckout && (
        <CheckoutDialog
          items={state.cart}
          onSuccess={() => {
            clearCart()
            setShowCheckout(false)
            toast.success('Prodej uložen')
          }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </div>
  )
}
