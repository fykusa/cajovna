import { useState, useEffect } from 'react'
import type { TeaRow, CajeCategory, CajeBaleni, CajeCartItem } from '../types'
import { getTeas } from '../api/teas'
import { createCajovnaSale } from '../api/cajovna'

export type CajeView = 'home' | 'categories' | 'teas' | 'packaging' | 'quantity' | 'checkout' | 'success'

export const CAJE_VIEW_ORDER: CajeView[] = [
  'home', 'categories', 'teas', 'packaging', 'quantity', 'checkout', 'success',
]

export function buildBaleni(tea: TeaRow): CajeBaleni[] {
  const opts: CajeBaleni[] = []
  if (tea.MN1 != null && tea.CENA1 != null)
    opts.push({ cislo: 1, label: 'Standard',  mn: tea.MN1, cena: tea.CENA1 })
  if (tea.MN2 != null && tea.CENA2 != null)
    opts.push({ cislo: 2, label: 'Větší',     mn: tea.MN2, cena: tea.CENA2 })
  if (tea.MN3 != null && tea.CENA3 != null)
    opts.push({ cislo: 3, label: 'Největší',  mn: tea.MN3, cena: tea.CENA3 })
  if (tea.MN4 != null && tea.CENA4 != null)
    opts.push({ cislo: 4, label: 'Čajovna',   mn: tea.MN4, cena: tea.CENA4 })
  return opts
}

export function deriveCategories(rows: TeaRow[]): CajeCategory[] {
  const seen = new Set<string>()
  const cats: CajeCategory[] = []
  for (const r of rows) {
    if (r.AKTIV !== 'x' || r.KATEGORIE == null) continue
    const key = `${r.KATEGORIE}||${r.ZEME ?? ''}`
    if (!seen.has(key)) {
      seen.add(key)
      cats.push({ kategorie: r.KATEGORIE, zeme: r.ZEME })
    }
  }
  return cats.sort((a, b) => a.kategorie.localeCompare(b.kategorie, 'cs'))
}

export function useCajovnaPOS() {
  const [view, setView]                     = useState<CajeView>('home')
  const [allRows, setAllRows]               = useState<TeaRow[]>([])
  const [categories, setCategories]         = useState<CajeCategory[]>([])
  const [teas, setTeas]                     = useState<TeaRow[]>([])
  const [selectedCategory, setSelectedCategory] = useState<CajeCategory | null>(null)
  const [selectedTea, setSelectedTea]       = useState<TeaRow | null>(null)
  const [baleniOptions, setBaleniOptions]   = useState<CajeBaleni[]>([])
  const [selectedBaleni, setSelectedBaleni] = useState<CajeBaleni | null>(null)
  const [cart, setCart]                     = useState<CajeCartItem[]>([])
  const [lastTotal, setLastTotal]           = useState(0)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [checkoutError, setCheckoutError]   = useState<string | null>(null)

  useEffect(() => {
    getTeas()
      .then((rows) => {
        setAllRows(rows)
        setCategories(deriveCategories(rows))
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Chyba načítání dat')
        setLoading(false)
      })
  }, [])

  function selectCategory(cat: CajeCategory) {
    setSelectedCategory(cat)
    setTeas(allRows.filter((r) => r.AKTIV === 'x' && r.KATEGORIE === cat.kategorie))
    setView('teas')
  }

  function selectTea(tea: TeaRow) {
    setSelectedTea(tea)
    const opts = buildBaleni(tea)
    setBaleniOptions(opts)
    setSelectedBaleni(opts[0] ?? null)
    setView('packaging')
  }

  function selectBaleni(b: CajeBaleni) {
    setSelectedBaleni(b)
    setView('quantity')
  }

  function selectKusu(n: number) {
    if (!selectedTea || !selectedBaleni) return
    const item: CajeCartItem = {
      localId: `${Date.now()}-${Math.random()}`,
      caj: selectedTea,
      baleni: selectedBaleni,
      kusu: n,
      celkCena: selectedBaleni.cena * n,
    }
    setCart((prev) => [...prev, item])
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setView('home')
  }

  function removeFromCart(localId: string) {
    setCart((prev) => prev.filter((i) => i.localId !== localId))
  }

  function goBack() {
    if (view === 'checkout') { setView('home'); return }
    const idx = CAJE_VIEW_ORDER.indexOf(view)
    if (idx <= 0) return
    setView(CAJE_VIEW_ORDER[idx - 1])
  }

  function goToCategories() { setView('categories') }

  function startCheckout() {
    setCheckoutError(null)
    setView('checkout')
  }

  async function confirmCheckout() {
    setCheckoutError(null)
    try {
      const polozky = cart.map((item) => ({
        caje_id:   item.caj.id,
        baleni:    item.baleni.cislo,
        kusu:      item.kusu,
        jedn_cena: item.baleni.cena,
        celk_cena: item.celkCena,
      }))
      const res = await createCajovnaSale(polozky)
      setLastTotal(res.total)
      setCart([])
      setView('success')
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    }
  }

  function newSale() {
    setCart([])
    setSelectedCategory(null)
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setView('home')
  }

  return {
    view, categories, teas, baleniOptions,
    selectedCategory, selectedTea, selectedBaleni,
    cart, lastTotal, loading, error, checkoutError,
    selectCategory, selectTea, selectBaleni, selectKusu,
    removeFromCart, goBack, goToCategories,
    startCheckout, confirmCheckout, newSale,
  }
}
