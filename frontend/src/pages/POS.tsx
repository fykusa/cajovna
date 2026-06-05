import { useEffect, useCallback, useState } from 'react'
import { usePOS } from '../hooks/usePOS'
import { useAuthStore } from '../store/authStore'
import { getSales, getSaleItems } from '../api/sales'
import CategoryPanel from '../components/pos/CategoryPanel'
import TeaPanel from '../components/pos/TeaPanel'
import SearchResults from '../components/pos/SearchResults'
import ConfigurePanel from '../components/pos/ConfigurePanel'
import { getPackagingOptions, getBagList } from '../hooks/usePOS'
import Cart from '../components/pos/Cart'
import CheckoutDialog from '../components/pos/CheckoutDialog'
import { useToast } from '../components/toast/useToast'
import HistoryPanel from '../components/pos/HistoryPanel'
import SalesSummary from '../components/pos/SalesSummary'
import POSNavbar from '../components/pos/POSNavbar'
import type { Sale, SaleItem } from '../types'
import styles from './POS.module.css'

export default function POS() {
  const {
    state,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    confirm,
    setQuantity,
    startSearch,
    appendSearch,
    cancelItem,
    removeFromCart,
    clearCart,
  } = usePOS()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [showCheckout, setShowCheckout] = useState(false)
  const toast = useToast()

  const [activeTab, setActiveTab] = useState<'sell' | 'overview'>('sell')
  const [history, setHistory] = useState<Sale[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [saleItemsByIndex, setSaleItemsByIndex] = useState<Record<number, SaleItem[]>>({})
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)


  const handleHistoryNavigation = useCallback(
    (direction: 'up' | 'down') => {
      if (activeTab !== 'overview' || history.length === 0) return
      const newIndex = direction === 'up'
        ? (historyIndex - 1 + history.length) % history.length
        : (historyIndex + 1) % history.length
      setHistoryIndex(newIndex)
      setSelectedSale(history[newIndex])
    },
    [activeTab, history, historyIndex],
  )

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // When in configure step, handle all arrows + Enter/Escape
      if (state.step === 'configure') {
        if (e.key === 'Enter') {
          e.preventDefault()
          confirm()
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          cancelItem()
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveUp()
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveDown()
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          moveLeft()
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          moveRight()
          return
        }
        return
      }

      // Normal navigation (category/tea/search steps)
      if (e.key === 'Enter') {
        e.preventDefault()
        confirm()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        cancelItem()
        return
      }

      if ((e.target as HTMLElement).tagName === 'INPUT') return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          if (activeTab === 'overview') {
            handleHistoryNavigation('up')
          } else {
            moveUp()
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (activeTab === 'overview') {
            handleHistoryNavigation('down')
          } else {
            moveDown()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveLeft()
          break
        case 'ArrowRight':
          e.preventDefault()
          moveRight()
          break
        case 'F10':
          if (state.cart.length > 0) {
            e.preventDefault()
            setShowCheckout(true)
          }
          break
        case 'Backspace':
          if ((state.step === 'category' || state.step === 'tea' || state.step === 'search') && state.searchQuery.length > 0) {
            e.preventDefault()
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
    },
    [state, moveUp, moveDown, moveLeft, moveRight, confirm, startSearch, cancelItem, activeTab, handleHistoryNavigation],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Načteme položky vybraného prodeje
  useEffect(() => {
    if (!selectedSale) {
      setSaleItems([])
      return
    }

    getSaleItems(selectedSale.id)
      .then((items) => {
        setSaleItems(items)
      })
      .catch(() => {
        setSaleItems([])
      })
  }, [selectedSale, saleItemsByIndex])

  // Reset selectedSale když se přepne na pokladnu
  useEffect(() => {
    if (activeTab === 'sell') {
      setSelectedSale(null)
    }
  }, [activeTab])

  const reloadHistory = useCallback(() => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    getSales({
      from: todayStr,
      to: `${todayStr} 23:59:59`,
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

  // Načteme dnešní prodeje na mount
  useEffect(() => {
    reloadHistory()
  }, [reloadHistory])

  // Načteme položky pro všechny prodeje v parallel
  useEffect(() => {
    if (history.length === 0) {
      setSaleItemsByIndex({})
      return
    }

    const promises = history.map((sale) =>
      getSaleItems(sale.id)
        .then((items) => {
          return { saleId: sale.id, items }
        })
        .catch((e) => {
          console.warn(`[History] Error loading items for sale ${sale.id}:`, e)
          return { saleId: sale.id, items: [] }
        })
    )

    Promise.all(promises)
      .then((results) => {
        const map: Record<number, SaleItem[]> = {}
        for (const { saleId, items } of results) {
          map[saleId] = items
        }
        setSaleItemsByIndex(map)
      })
      .catch(() => {
        setSaleItemsByIndex({})
      })
  }, [history])

  function renderMainPanel() {
    const displayTeas = state.searchQuery.length > 0 ? state.searchResults : state.teas

    // Split layout for category/tea/search steps
    if (state.step === 'category' || state.step === 'tea' || state.step === 'search') {
      return (
        <div className={styles.splitLayout}>
          <CategoryPanel
            categories={state.categories}
            selectedIndex={state.categoryIndex}
            isActive={state.activePanel === 'categories' && !state.searchQuery}
          />
          <TeaPanel
            teas={displayTeas}
            selectedIndex={state.step === 'search' ? state.searchIndex : state.teaIndex}
            isActive={state.activePanel === 'teas' || state.searchQuery.length > 0}
            isFilterActive={state.searchQuery.length > 0}
            filterQuery={state.searchQuery}
          />
        </div>
      )
    }

    // Configure panel — balení, množství, pytlík
    if (state.step === 'configure' && state.selectedTea) {
      const packagingOptions = getPackagingOptions(state.selectedTea)
      const bagList = getBagList(state.bags)
      return (
        <div className={styles.splitLayout}>
          <ConfigurePanel
            tea={state.selectedTea}
            packagingOptions={packagingOptions}
            packagingIndex={state.packagingIndex}
            quantity={state.quantity}
            bagList={bagList}
            bagIndex={state.bagIndex}
            activePanel={state.configPanel}
          />
        </div>
      )
    }

    return <div>Unknown step</div>
  }

  if (state.loading) return <div className={styles.loading}>Načítám data…</div>
  if (state.error) return <div className={styles.error}>Chyba: {state.error}</div>

  return (
    <div className={styles.layout}>
      <POSNavbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        username={user?.username || ''}
        onLogout={logout}
        step={state.step}
      />

      <main className={styles.main}>
        {/* Pokladna (prodej) */}
        {activeTab === 'sell' && (
          <>
            <section className={styles.panel}>
              {renderMainPanel()}
            </section>

            <aside className={styles.cartPanel}>
              <Cart
                items={state.cart}
                selectedSale={selectedSale}
                saleItems={saleItems}
                onRemove={removeFromCart}
                onCheckout={() => setShowCheckout(true)}
              />
            </aside>
          </>
        )}

        {/* Přehled (história) */}
        {activeTab === 'overview' && (
          <>
            <section className={styles.panel}>
              {user && <SalesSummary sales={history} currentUsername={user.username} />}
              <div className={styles.historyPanelFull}>
                {historyLoading ? (
                  <div style={{ padding: '12px', color: '#666' }}>Načítám...</div>
                ) : historyError ? (
                  <div style={{ padding: '12px', color: '#e67e7e' }}>{historyError}</div>
                ) : history.length === 0 ? (
                  <div style={{ padding: '12px', color: '#666' }}>Není k dispozici</div>
                ) : (
                  <HistoryPanel
                    sales={history}
                    saleItemsByIndex={saleItemsByIndex}
                    selectedIndex={historyIndex}
                    onSelect={(sale, idx) => {
                      setHistoryIndex(idx)
                      setSelectedSale(sale)
                    }}
                    isActive={true}
                  />
                )}
              </div>
            </section>

            <aside className={styles.cartPanel}>
              <Cart
                items={state.cart}
                selectedSale={selectedSale}
                saleItems={saleItems}
                onRemove={removeFromCart}
                onCheckout={() => setShowCheckout(true)}
              />
            </aside>
          </>
        )}
      </main>

      {showCheckout && (
        <CheckoutDialog
          items={state.cart}
          onSuccess={() => {
            clearCart()
            setShowCheckout(false)
            toast.success('Prodej uložen')
            reloadHistory()
          }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </div>
  )
}
