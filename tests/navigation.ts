import { expect, type Page } from '@playwright/test'

// Reopening the app starts at Home; tests then explicitly open their trip.
export async function openTrips(page: Page) {
  await expect(page.locator('.travel-home')).toBeVisible()
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '내 여행', exact: true })
    .click()
}
