// frontend/src/pages/MobilePOS.tsx
import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMobilePOS, VIEW_ORDER, type MobileView } from '../hooks/useMobilePOS'
import { useAuthStore } from '../store/authStore'
import { getPackagingOptions } from '../hooks/posHelpers'
import MobileTopBar from '../components/pos-mobile/MobileTopBar'
import MobileHistory from '../components/pos-mobile/MobileHistory'
import MobileHeader from '../components/pos-mobile/MobileHeader'
import MobileProgressBar from '../components/pos-mobile/MobileProgressBar'
import MobileHome from '../components/pos-mobile/MobileHome'
import MobileCategories from '../components/pos-mobile/MobileCategories'
import MobileTeas from '../components/pos-mobile/MobileTeas'
import MobilePackaging from '../components/pos-mobile/MobilePackaging'
import MobileQuantity from '../components/pos-mobile/MobileQuantity'
import MobileBags from '../components/pos-mobile/MobileBags'
import MobileCheckout from '../components/pos-mobile/MobileCheckout'
import MobileSuccess from '../components/pos-mobile/MobileSuccess'
import styles from './MobilePOS.module.css'

const VIEW_TITLES: Record<MobileView, string> = {
  home: 'Čajovna POS',
  categories: 'Kategorie',
  teas: 'Vyberte čaj',
  packaging: 'Typ balení',
  quantity: 'Množství',
  bags: 'Typ pytlíku',
  checkout: 'Přehled prodeje',
  success: 'Hotovo',
}

export default function MobilePOS() {
  const pos = useMobilePOS()
  const [mode, setMode] = useState<'pos' | 'history'>('pos')
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const prevViewRef = useRef<MobileView>('home')
  const [slideClass, setSlideClass] = useState<string>('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const prevIdx = VIEW_ORDER.indexOf(prevViewRef.current)
    const newIdx = VIEW_ORDER.indexOf(pos.view)
    if (prevViewRef.current !== pos.view) {
      setSlideClass(newIdx >= prevIdx ? styles.slideFwd : styles.slideBack)
    }
    prevViewRef.current = pos.view
  }, [pos.view])

  async function handleConfirmCheckout() {
    setCheckoutLoading(true)
    await pos.confirmCheckout()
    setCheckoutLoading(false)
  }

  if (pos.loading) return <div className={styles.loading}>Načítám…</div>
  if (pos.error) return <div className={styles.loading}>Chyba: {pos.error}</div>

  const showBack = pos.view !== 'home' && pos.view !== 'success'
  const packagingOptions = pos.selectedTea ? getPackagingOptions(pos.selectedTea) : []

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <MobileTopBar
          mode={mode}
          onModeChange={setMode}
          username={user?.username ?? ''}
          onLogout={handleLogout}
        />
        {mode === 'pos' && (
          <div className={`${styles.view} ${slideClass}`}>
            {pos.view !== 'success' && (
              <MobileHeader
                title={VIEW_TITLES[pos.view]}
                subtitle={pos.selectedCategory?.name}
                cartCount={pos.cart.length}
                onBack={showBack ? pos.goBack : undefined}
              />
            )}
            <MobileProgressBar view={pos.view} />

            {pos.view === 'home' && (
              <MobileHome
                cart={pos.cart}
                onAddItem={pos.goToCategories}
                onCheckout={pos.startCheckout}
                onRemove={pos.removeFromCart}
              />
            )}
            {pos.view === 'categories' && (
              <MobileCategories categories={pos.categories} onSelect={pos.selectCategory} />
            )}
            {pos.view === 'teas' && (
              <MobileTeas
                teas={pos.teas}
                categoryName={pos.selectedCategory?.name ?? ''}
                onSelect={pos.selectTea}
              />
            )}
            {pos.view === 'packaging' && (
              <MobilePackaging
                options={packagingOptions}
                selected={pos.selectedPackaging}
                onSelect={pos.selectPackaging}
              />
            )}
            {pos.view === 'quantity' && pos.selectedPackaging && (
              <MobileQuantity packaging={pos.selectedPackaging} onSelect={pos.selectQuantity} />
            )}
            {pos.view === 'bags' && (
              <MobileBags bagList={pos.bagList} onSelect={pos.selectBag} />
            )}
            {pos.view === 'checkout' && (
              <MobileCheckout
                cart={pos.cart}
                error={pos.checkoutError}
                loading={checkoutLoading}
                onConfirm={handleConfirmCheckout}
                onBack={pos.goBack}
              />
            )}
            {pos.view === 'success' && (
              <MobileSuccess total={pos.lastTotal} onNewSale={pos.newSale} />
            )}
          </div>
        )}
        {mode === 'history' && <MobileHistory />}
      </div>
    </div>
  )
}
