import { useEffect, useCallback, useState } from 'react'
import { usePOS } from '../hooks/usePOS'
import { useAuthStore } from '../store/authStore'
import CategoryList from '../components/pos/CategoryList'
import TeaList from '../components/pos/TeaList'
import SearchResults from '../components/pos/SearchResults'
import QuantitySelector from '../components/pos/QuantitySelector'
import BagSelector from '../components/pos/BagSelector'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import styles from './POS.module.css'

export default function POS() {
  const { state, moveUp, moveDown, confirm, setQuantity,
          startSearch, appendSearch, cancelSearch, removeFromCart, clearCart } = usePOS()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [showCheckout, setShowCheckout] = useState(false)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      confirm()
      return
    }

    if ((e.target as HTMLElement).tagName === 'INPUT') return

    switch (e.key) {
      case 'ArrowUp':   e.preventDefault(); moveUp(); break
      case 'ArrowDown': e.preventDefault(); moveDown(); break
      case 'Escape':
        if (state.step === 'search') cancelSearch()
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
  }, [state, moveUp, moveDown, confirm, startSearch, appendSearch, cancelSearch])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

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
          }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </div>
  )
}
