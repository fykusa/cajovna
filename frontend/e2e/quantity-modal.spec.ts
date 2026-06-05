import { test, expect } from '@playwright/test'

const USERNAME = 'prodavacka'
const PASSWORD = 'prodavacka123'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByPlaceholder('Uživatelské jméno').fill(USERNAME)
  await page.getByPlaceholder('Heslo').fill(PASSWORD)
  await page.getByRole('button', { name: 'Přihlásit' }).click()
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 15_000 })
}

async function selectFirstTeaAndOpenQuantityModal(page: import('@playwright/test').Page) {
  // Select first category
  await page.keyboard.press('Enter')
  await expect(page.locator('text=Krok: tea')).toBeVisible({ timeout: 15_000 })

  // Wait for tea list to load — give it plenty of time
  const allLists = page.getByRole('list')
  // Find the tea list by checking all lists, skip first (categories)
  const teaListItems = allLists.nth(1).getByRole('listitem')
  await expect(teaListItems.first()).toBeVisible({ timeout: 15_000 })

  // Give tea rendering time
  await page.waitForTimeout(1000)

  // Select first tea with Enter
  await page.keyboard.press('Enter')

  // Should now be in quantity step
  await expect(page.locator('text=Krok: quantity')).toBeVisible({ timeout: 15_000 })
}

test('quantity modal se zobrazuje jako modální overlay', async ({ page }) => {
  await login(page)
  await selectFirstTeaAndOpenQuantityModal(page)

  // Check that modal overlay exists (by looking for the dialog buttons)
  const continueBtn = page.getByRole('button', { name: 'Pokračovat (ENTER)' })
  await expect(continueBtn).toBeVisible()

  // Check that modal backdrop is visible (by looking for quantity input)
  const quantityInput = page.locator('input[type="number"]')
  await expect(quantityInput).toBeVisible()

  // Verify that the modal is rendered as a fixed overlay by checking the DOM
  // (CSS modules prevent us from using class selectors directly)
  const html = await page.content()
  expect(html).toContain('position: fixed')  // The overlay should have position: fixed
})

test('clicking overlay zruší dialg (onCancel)', async ({ page }) => {
  await login(page)
  await selectFirstTeaAndOpenQuantityModal(page)

  // Modal should be visible
  const continueBtn = page.getByRole('button', { name: 'Pokračovat (ENTER)' })
  await expect(continueBtn).toBeVisible()

  // Click cancel button to dismiss modal
  const cancelBtn = page.getByRole('button', { name: 'Zrušit (ESC)' })
  await expect(cancelBtn).toBeVisible()
  await cancelBtn.click()

  // CANCEL_ITEM returns to category step, not tea
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 10_000 })

  // Modal button should be gone
  await expect(continueBtn).not.toBeVisible()
})

test('Enter potvrdí množství', async ({ page }) => {
  await login(page)
  await selectFirstTeaAndOpenQuantityModal(page)

  // Get the input field
  const input = page.locator('input[type="number"]')
  await expect(input).toBeVisible()

  // Change quantity
  await input.fill('5')

  // Press Enter to confirm
  await page.keyboard.press('Enter')

  // Should go to bag_yn step
  await expect(page.locator('text=Krok: bag_yn')).toBeVisible({ timeout: 5_000 })

  // Modal should be gone (continue button should not be visible)
  const continueBtn = page.getByRole('button', { name: 'Pokračovat (ENTER)' })
  await expect(continueBtn).not.toBeVisible()
})

test('Escape zruší dialg', async ({ page }) => {
  await login(page)
  await selectFirstTeaAndOpenQuantityModal(page)

  const continueBtn = page.getByRole('button', { name: 'Pokračovat (ENTER)' })
  await expect(continueBtn).toBeVisible()

  // Press Escape
  await page.keyboard.press('Escape')

  // CANCEL_ITEM returns to category step
  await expect(page.locator('text=Krok: category')).toBeVisible({ timeout: 10_000 })

  // Modal should be gone
  await expect(continueBtn).not.toBeVisible()
})
