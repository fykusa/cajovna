# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pos-flow.spec.ts >> šipka dolů posune zvýraznění na druhou kategorii
- Location: e2e\pos-flow.spec.ts:26:1

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: getByRole('list').first().getByRole('listitem').nth(1)
Expected pattern: /active/
Received string:  "_item_bhbx6_37 _selected_bhbx6_49"
Timeout: 5000ms

Call log:
  - Expect "toHaveClass" with timeout 5000ms
  - waiting for getByRole('list').first().getByRole('listitem').nth(1)
    14 × locator resolved to <li role="listitem" class="_item_bhbx6_37 _selected_bhbx6_49">Bílé</li>
       - unexpected value "_item_bhbx6_37 _selected_bhbx6_49"

```

```yaml
- listitem: Bílé
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | // Credentials: prodavacka / prodavacka123 (role=prodavacka → /pos)
  4   | const USERNAME = 'prodavacka'
  5   | const PASSWORD = 'prodavacka123'
  6   | 
  7   | async function login(page: import('@playwright/test').Page) {
  8   |   await page.goto('/login')
  9   |   await page.getByPlaceholder('Uživatelské jméno').fill(USERNAME)
  10  |   await page.getByPlaceholder('Heslo').fill(PASSWORD)
  11  |   await page.getByRole('button', { name: 'Přihlásit' }).click()
  12  |   // Wait for POS to load — header contains step indicator
  13  |   await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 15_000 })
  14  | }
  15  | 
  16  | test('zobrazí seznam kategorií po přihlášení', async ({ page }) => {
  17  |   await login(page)
  18  |   // CategoryList renders a <ul role="list"> with category items
  19  |   const list = page.getByRole('list').first()
  20  |   await expect(list).toBeVisible()
  21  |   // At least one category item must be present
  22  |   const items = list.getByRole('listitem')
  23  |   await expect(items.first()).toBeVisible()
  24  | })
  25  | 
  26  | test('šipka dolů posune zvýraznění na druhou kategorii', async ({ page }) => {
  27  |   await login(page)
  28  |   const list = page.getByRole('list').first()
  29  |   await expect(list.getByRole('listitem').first()).toBeVisible()
  30  | 
  31  |   // Press ArrowDown — focus stays on body/document, not on an input
  32  |   await page.keyboard.press('ArrowDown')
  33  | 
  34  |   // The step indicator still says category (not yet confirmed)
  35  |   await expect(page.locator('text=Krok: category')).toBeVisible()
  36  | 
  37  |   const firstItem = list.getByRole('listitem').first()
  38  |   const secondItem = list.getByRole('listitem').nth(1)
  39  |   await expect(firstItem).not.toHaveClass(/active/)
> 40  |   await expect(secondItem).toHaveClass(/active/)
      |                            ^ Error: expect(locator).toHaveClass(expected) failed
  41  | })
  42  | 
  43  | test('Enter vybere kategorii a zobrazí čaje', async ({ page }) => {
  44  |   await login(page)
  45  |   // Confirm first category with Enter
  46  |   await page.keyboard.press('Enter')
  47  |   // Step should change to 'tea'
  48  |   await expect(page.locator('text=Krok: tea')).toBeVisible({ timeout: 10_000 })
  49  |   // TeaList should appear with at least one item
  50  |   const list = page.getByRole('list').first()
  51  |   await expect(list.getByRole('listitem').first()).toBeVisible({ timeout: 10_000 })
  52  | })
  53  | 
  54  | test('psaní písmene otevře search a filtruje výsledky', async ({ page }) => {
  55  |   await login(page)
  56  |   // Type 'M' while in category step — triggers startSearch
  57  |   await page.keyboard.press('m')
  58  |   // SearchResults renders "Hledám: <query>"
  59  |   await expect(page.locator('text=Hledám')).toBeVisible({ timeout: 5_000 })
  60  |   // Type more to narrow — 'an' → 'man', matching "Mandarinky" etc.
  61  |   await page.keyboard.press('a')
  62  |   await page.keyboard.press('n')
  63  |   // Results list should be visible
  64  |   const list = page.getByRole('list').first()
  65  |   await expect(list.getByRole('listitem').first()).toBeVisible()
  66  | })
  67  | 
  68  | test('kompletní prodej bez pytlíku', async ({ page }) => {
  69  |   await login(page)
  70  | 
  71  |   // Step 1: category — press Enter to confirm first category
  72  |   await page.keyboard.press('Enter')
  73  |   await expect(page.locator('text=Krok: tea')).toBeVisible({ timeout: 10_000 })
  74  | 
  75  |   // Step 2: tea — wait for teas to load, then confirm first tea
  76  |   const teaList = page.getByRole('list').first()
  77  |   await expect(teaList.getByRole('listitem').first()).toBeVisible({ timeout: 10_000 })
  78  |   await page.keyboard.press('Enter')
  79  |   await expect(page.locator('text=Krok: quantity')).toBeVisible({ timeout: 5_000 })
  80  | 
  81  |   // Step 3: quantity — Enter funguje i když je input focusnutý
  82  |   await page.keyboard.press('Enter')
  83  |   await expect(page.locator('text=Krok: bag_yn')).toBeVisible({ timeout: 5_000 })
  84  | 
  85  |   // Step 4: bag_yn — default is wantBag=true (Ano active).
  86  |   // ArrowDown toggles to wantBag=false (Ne active), then Enter confirms no bag
  87  |   await page.keyboard.press('ArrowDown')
  88  |   const neOption = page.getByRole('list').first().getByRole('listitem').nth(1)
  89  |   await expect(neOption).toHaveClass(/active/)
  90  |   await page.keyboard.press('Enter')
  91  | 
  92  |   // Should return to category step with 1 cart item
  93  |   await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 5_000 })
  94  | 
  95  |   // Cart must have exactly 1 item (li in the cart list)
  96  |   // Cart heading is "Košík" — find the cart section by heading
  97  |   const cartHeading = page.getByRole('heading', { name: 'Košík' })
  98  |   await expect(cartHeading).toBeVisible()
  99  |   // The checkout button "Zaplatit" should now be visible
  100 |   const payBtn = page.getByRole('button', { name: 'Zaplatit' })
  101 |   await expect(payBtn).toBeVisible()
  102 | 
  103 |   // Click Zaplatit — opens CheckoutDialog
  104 |   await payBtn.click()
  105 |   // CheckoutDialog has heading "Souhrn prodeje"
  106 |   await expect(page.getByRole('heading', { name: 'Souhrn prodeje' })).toBeVisible({ timeout: 5_000 })
  107 | })
  108 | 
  109 | test('SPACE přepne do history mode a zobrazí historii', async ({ page }) => {
  110 |   await login(page)
  111 | 
  112 |   // SPACE bez rozpracovaného prodeje by nemělo nic udělat (guard na step === 'category')
  113 |   const initialMode = page.locator('[class*=modeIndicator]')
  114 |   await expect(initialMode).not.toBeVisible()
  115 | 
  116 |   // Ale история panel by měl být vidět v dolní části
  117 |   const historyPanel = page.locator('[class*=historyPanel]').first()
  118 |   await expect(historyPanel).toBeVisible()
  119 | 
  120 |   // Ověříme že je text "Dnešní prodeje"
  121 |   const historyHeader = page.locator('text=Dnešní prodeje')
  122 |   await expect(historyHeader).toBeVisible()
  123 | })
  124 | 
```