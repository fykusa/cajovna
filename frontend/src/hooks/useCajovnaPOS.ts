import { useState, useEffect, useMemo } from 'react'
import type { TeaRow, CajeBaleni, CajeCartItem } from '../types'
import { getTeas } from '../api/teas'
import { createCajovnaSale } from '../api/cajovna'

export type CajeView = 'home' | 'categories' | 'countries' | 'teas' | 'packaging' | 'quantity' | 'checkout'

export const CAJE_VIEW_ORDER: CajeView[] = [
  'home', 'categories', 'countries', 'teas', 'packaging', 'quantity', 'checkout',
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

export function deriveCategories(rows: TeaRow[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.AKTIV !== 'x' || r.KATEGORIE == null) continue
    seen.add(r.KATEGORIE)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'cs'))
}

export function deriveZeme(rows: TeaRow[], kategorie: string): string[] {
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.AKTIV !== 'x' || r.KATEGORIE !== kategorie || !r.ZEME) continue
    seen.add(r.ZEME)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, 'cs'))
}

export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function useCajovnaPOS() {
  const [view, setView]                     = useState<CajeView>('home')
  const [allRows, setAllRows]               = useState<TeaRow[]>([])
  const [categories, setCategories]         = useState<string[]>([])
  const [teas, setTeas]                     = useState<TeaRow[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedZeme, setSelectedZeme]     = useState<string | null>(null)
  const [zemeOptions, setZemeOptions]       = useState<string[]>([])
  const [selectedTea, setSelectedTea]       = useState<TeaRow | null>(null)
  const [baleniOptions, setBaleniOptions]   = useState<CajeBaleni[]>([])
  const [selectedBaleni, setSelectedBaleni] = useState<CajeBaleni | null>(null)
  const [cart, setCart]                     = useState<CajeCartItem[]>([])
  const [lastTotal, setLastTotal]           = useState(0)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [checkoutError, setCheckoutError]   = useState<string | null>(null)
  const [searchQuery, setSearchQuery]       = useState('')

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

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length === 0) return []
    const q = normalizeSearch(searchQuery)
    return allRows.filter((r) => r.AKTIV === 'x' && r.NAZEV != null && normalizeSearch(r.NAZEV).includes(q))
  }, [allRows, searchQuery])

  function filterTeas(kategorie: string, zeme: string | null): TeaRow[] {
    return allRows.filter((r) =>
      r.AKTIV === 'x' && r.KATEGORIE === kategorie && (zeme === null || r.ZEME === zeme)
    )
  }

  function selectCategory(kategorie: string) {
    setSelectedCategory(kategorie)
    setSelectedZeme(null)
    const opts = deriveZeme(allRows, kategorie)
    setZemeOptions(opts)
    if (opts.length >= 2) {
      setView('countries')
    } else {
      setTeas(filterTeas(kategorie, null))
      setView('teas')
    }
  }

  function selectZeme(zeme: string | null) {
    if (selectedCategory === null) return
    setSelectedZeme(zeme)
    setTeas(filterTeas(selectedCategory, zeme))
    setView('teas')
  }

  function selectTea(tea: TeaRow) {
    setSelectedTea(tea)
    const opts = buildBaleni(tea)
    setBaleniOptions(opts)
    setSelectedBaleni(opts[0] ?? null)
    setSearchQuery('')
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
    // krok zemí se u kategorií s 0–1 zeměmi přeskakuje i cestou zpět
    if (view === 'teas' && zemeOptions.length < 2) { setView('categories'); return }
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
        caje_kod:  item.caj.KOD,
        baleni:    item.baleni.cislo,
        kusu:      item.kusu,
        jedn_cena: item.baleni.cena,
        celk_cena: item.celkCena,
      }))
      const res = await createCajovnaSale(polozky)
      setLastTotal(res.total)
      newSale()
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Chyba při zápisu prodeje')
    }
  }

  function newSale() {
    setCart([])
    setSelectedCategory(null)
    setSelectedZeme(null)
    setZemeOptions([])
    setSelectedTea(null)
    setSelectedBaleni(null)
    setBaleniOptions([])
    setSearchQuery('')
    setView('home')
  }

  return {
    view, categories, teas, baleniOptions, zemeOptions,
    selectedCategory, selectedZeme, selectedTea, selectedBaleni,
    cart, lastTotal, loading, error, checkoutError,
    searchQuery, searchResults, setSearchQuery,
    selectCategory, selectZeme, selectTea, selectBaleni, selectKusu,
    removeFromCart, goBack, goToCategories,
    startCheckout, confirmCheckout, newSale,
  }
}
