import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCajovnaPOS, CAJE_VIEW_ORDER, type CajeView } from '../hooks/useCajovnaPOS'
import { useAuthStore } from '../store/authStore'
import MobileTopBar from '../components/pos-mobile/MobileTopBar'
import MobileHeader from '../components/pos-mobile/MobileHeader'
import CajeProgressBar from '../components/pos-cajovna/CajeProgressBar'
import CajeCategories from '../components/pos-cajovna/CajeCategories'
import CajeTeas from '../components/pos-cajovna/CajeTeas'
import CajePackaging from '../components/pos-cajovna/CajePackaging'
import CajeQuantity from '../components/pos-cajovna/CajeQuantity'
import CajeHome from '../components/pos-cajovna/CajeHome'
import CajeCheckout from '../components/pos-cajovna/CajeCheckout'
import CajeHistory from '../components/pos-cajovna/CajeHistory'
import CajeKasa from '../components/pos-cajovna/CajeKasa'
import styles from './MobilePOS.module.css'

const VIEW_TITLES: Record<CajeView, string> = {
  home:       'TAO čajovna',
  categories: 'Kategorie',
  teas:       'Vyberte čaj',
  packaging:  'Typ balení',
  quantity:   'Množství',
  checkout:   'Přehled prodeje',
}

export default function CajovnaPOS() {
  const pos      = useCajovnaPOS()
  const [mode, setMode]           = useState<'pos' | 'history' | 'kasa'>('pos')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const user     = useAuthStore((s) => s.user)
  const logout   = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const prevViewRef = useRef<CajeView>('home')
  const [slideClass, setSlideClass] = useState('')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const prevIdx = CAJE_VIEW_ORDER.indexOf(prevViewRef.current)
    const newIdx  = CAJE_VIEW_ORDER.indexOf(pos.view)
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
  if (pos.error)   return <div className={styles.loading}>Chyba: {pos.error}</div>

  const showBack = pos.view !== 'home'
  const categoryName = pos.selectedCategory
    ? `${pos.selectedCategory.kategorie}${pos.selectedCategory.zeme ? ` — ${pos.selectedCategory.zeme}` : ''}`
    : ''

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
            <MobileHeader
              title={VIEW_TITLES[pos.view]}
              subtitle={pos.view === 'teas' ? categoryName : undefined}
              cartCount={pos.cart.length}
              onBack={showBack ? pos.goBack : undefined}
            />
            <CajeProgressBar view={pos.view} />

            {pos.view === 'home' && (
              <CajeHome
                cart={pos.cart}
                onAddItem={pos.goToCategories}
                onCheckout={pos.startCheckout}
                onRemove={pos.removeFromCart}
              />
            )}
            {pos.view === 'categories' && (
              <CajeCategories categories={pos.categories} onSelect={pos.selectCategory} />
            )}
            {pos.view === 'teas' && (
              <CajeTeas
                teas={pos.teas}
                categoryName={categoryName}
                onSelect={pos.selectTea}
              />
            )}
            {pos.view === 'packaging' && (
              <CajePackaging
                options={pos.baleniOptions}
                selected={pos.selectedBaleni}
                onSelect={pos.selectBaleni}
              />
            )}
            {pos.view === 'quantity' && pos.selectedBaleni && (
              <CajeQuantity baleni={pos.selectedBaleni} onSelect={pos.selectKusu} />
            )}
            {pos.view === 'checkout' && (
              <CajeCheckout
                cart={pos.cart}
                error={pos.checkoutError}
                loading={checkoutLoading}
                onConfirm={handleConfirmCheckout}
                onBack={pos.goBack}
              />
            )}
          </div>
        )}

        {mode === 'history' && <CajeHistory />}
        {mode === 'kasa' && <CajeKasa />}
      </div>
    </div>
  )
}
