// e2e/mobile-pos-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Mobilní POS flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[autocomplete="username"]', 'prodavacka')
    await page.fill('input[autocomplete="current-password"]', 'prodavacka123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/pos')
  })

  test('zobrazí prázdný košík po přihlášení', async ({ page }) => {
    await expect(page.getByText('Košík je prázdný')).toBeVisible()
    await expect(page.getByText('Čajovna POS')).toBeVisible()
  })

  test('kompletní flow přidání čaje do košíku', async ({ page }) => {
    await page.getByText('+ Přidat položku').click()
    await expect(page.getByText('Kategorie')).toBeVisible()

    const firstCat = page.locator('button').first()
    await firstCat.click()
    await expect(page.getByText('Vyberte čaj')).toBeVisible()

    await page.locator('button').first().click()
    await expect(page.getByText('Typ balení')).toBeVisible()

    await page.locator('button').first().click()
    await expect(page.getByText('Množství')).toBeVisible()

    await page.locator('button').first().click()
    await expect(page.getByText('Typ pytlíku')).toBeVisible()

    await page.getByText('Žádný').click()

    await expect(page.getByText('Zaúčtovat prodej')).toBeVisible()
    await expect(page.locator('[class*="item"]')).toHaveCount(1)
  })

  test('zaúčtování prodeje → success screen', async ({ page }) => {
    await page.getByText('+ Přidat položku').click()
    await page.locator('button').first().click()
    await page.locator('button').first().click()
    await page.locator('button').first().click()
    await page.locator('button').first().click()
    await page.getByText('Žádný').click()

    await page.getByText('Zaúčtovat prodej').click()
    await expect(page.getByText('Přehled prodeje')).toBeVisible()
    await page.getByText('Zákazník zaplatil').click()
    await expect(page.getByText('Prodej zaúčtován')).toBeVisible()
    await page.getByText('Nový prodej').click()
    await expect(page.getByText('Košík je prázdný')).toBeVisible()
  })
})
