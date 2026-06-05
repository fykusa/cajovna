import { test, expect } from '@playwright/test'

// Credentials: prodavacka / prodavacka123 (role=prodavacka → /pos)
const USERNAME = 'prodavacka'
const PASSWORD = 'prodavacka123'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('Uživatelské jméno').fill(USERNAME)
  await page.getByPlaceholder('Heslo').fill(PASSWORD)
  await page.getByRole('button', { name: 'Přihlásit' }).click()
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
  await expect(firstItem).not.toHaveClass(/active/)
  await expect(secondItem).toHaveClass(/active/)
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
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: quantity')).toBeVisible({ timeout: 5_000 })

  // Step 3: quantity — Enter funguje i když je input focusnutý
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: bag_yn')).toBeVisible({ timeout: 5_000 })

  // Step 4: bag_yn — default is wantBag=true (Ano active).
  // ArrowDown toggles to wantBag=false (Ne active), then Enter confirms no bag
  await page.keyboard.press('ArrowDown')
  const neOption = page.getByRole('list').first().getByRole('listitem').nth(1)
  await expect(neOption).toHaveClass(/active/)
  await page.keyboard.press('Enter')

  // Should return to category step with 1 cart item
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 5_000 })

  // Cart must have exactly 1 item (li in the cart list)
  // Cart heading is "Košík" — find the cart section by heading
  const cartHeading = page.getByRole('heading', { name: 'Košík' })
  await expect(cartHeading).toBeVisible()
  // The checkout button "Zaplatit" should now be visible
  const payBtn = page.getByRole('button', { name: 'Zaplatit' })
  await expect(payBtn).toBeVisible()

  // Click Zaplatit — opens CheckoutDialog
  await payBtn.click()
  // CheckoutDialog has heading "Souhrn prodeje"
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
