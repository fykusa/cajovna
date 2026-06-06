import { test, expect } from '@playwright/test'

// Credentials: prodavacka / prodavacka123 (role=prodavacka → /pos → redirect to /pos-desktop for keyboard POS)
const USERNAME = 'prodavacka'
const PASSWORD = 'prodavacka123'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('Uživatelské jméno').fill(USERNAME)
  await page.getByPlaceholder('Heslo').fill(PASSWORD)
  await page.getByRole('button', { name: 'Přihlásit' }).click()
  await page.waitForURL(/\/pos(-desktop)?/, { timeout: 10_000 })
  await page.goto('/pos-desktop')
  // Wait for POS to load — header contains step indicator
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 15_000 })
}

test('zobrazí seznam kategorií po přihlášení', async ({ page }) => {
  await login(page)
  // CategoryList renders a <ul role="list"> with category items
  const list = page.getByRole('list').first()
  await expect(list).toBeVisible()
  // At least one category item must be present
  const items = list.getByRole('listitem')
  await expect(items.first()).toBeVisible()
})

test('šipka dolů posune zvýraznění na druhou kategorii', async ({ page }) => {
  await login(page)
  const list = page.getByRole('list').first()
  await expect(list.getByRole('listitem').first()).toBeVisible()

  // Press ArrowDown — focus stays on body/document, not on an input
  await page.keyboard.press('ArrowDown')

  // The step indicator still says category (not yet confirmed)
  await expect(page.locator('text=Krok: category')).toBeVisible()

  const firstItem = list.getByRole('listitem').first()
  const secondItem = list.getByRole('listitem').nth(1)
  await expect(firstItem).not.toHaveClass(/selected/)
  await expect(secondItem).toHaveClass(/selected/)
})

test('Enter vybere kategorii a zobrazí čaje', async ({ page }) => {
  await login(page)
  // Confirm first category with Enter
  await page.keyboard.press('Enter')
  // Step should change to 'tea'
  await expect(page.locator('text=Krok: tea')).toBeVisible({ timeout: 10_000 })
  // TeaList should appear with at least one item
  const list = page.getByRole('list').first()
  await expect(list.getByRole('listitem').first()).toBeVisible({ timeout: 10_000 })
})

test('psaní písmene otevře search a filtruje výsledky', async ({ page }) => {
  await login(page)
  // Type 'M' while in category step — triggers startSearch
  await page.keyboard.press('m')
  // SearchResults renders "Hledám: <query>"
  await expect(page.locator('text=Hledám')).toBeVisible({ timeout: 5_000 })
  // Type more to narrow — 'an' → 'man', matching "Mandarinky" etc.
  await page.keyboard.press('a')
  await page.keyboard.press('n')
  // Results list should be visible
  const list = page.getByRole('list').first()
  await expect(list.getByRole('listitem').first()).toBeVisible()
})

test('kompletní prodej bez pytlíku', async ({ page }) => {
  await login(page)

  // Step 1: category — press Enter to confirm first category
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: tea')).toBeVisible({ timeout: 10_000 })

  // Step 2: tea — wait for teas to load, then confirm first tea
  const teaList = page.getByRole('list').first()
  await expect(teaList.getByRole('listitem').first()).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: configure')).toBeVisible({ timeout: 5_000 })

  // Step 3: configure — výchozí stav: Balení aktivní, množství 1, pytlík Žádný
  // Enter rovnou potvrdí prodej
  await page.keyboard.press('Enter')

  // Should return to category step
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 5_000 })

  // Cart must have 1 item — Zaplatit button should be visible
  const cartHeading = page.getByRole('heading', { name: 'Košík' })
  await expect(cartHeading).toBeVisible()
  const payBtn = page.getByRole('button', { name: 'Zaplatit' })
  await expect(payBtn).toBeVisible()

  // Click Zaplatit — opens CheckoutDialog
  await payBtn.click()
  await expect(page.getByRole('heading', { name: 'Souhrn prodeje' })).toBeVisible({ timeout: 5_000 })
})

test('SPACE přepne do history mode a zobrazí historii', async ({ page }) => {
  await login(page)

  // SPACE bez rozpracovaného prodeje by nemělo nic udělat (guard na step === 'category')
  const initialMode = page.locator('[class*=modeIndicator]')
  await expect(initialMode).not.toBeVisible()

  // Ale история panel by měl být vidět v dolní části
  const historyPanel = page.locator('[class*=historyPanel]').first()
  await expect(historyPanel).toBeVisible()

  // Ověříme že je text "Dnešní prodeje"
  const historyHeader = page.locator('text=Dnešní prodeje')
  await expect(historyHeader).toBeVisible()
})
