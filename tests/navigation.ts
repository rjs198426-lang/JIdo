import { expect, type Page } from '@playwright/test'

// Reopening the app starts at Home; tests then explicitly open their trip.
export async function openTrips(page: Page) {
  await expect(page.locator('.travel-home')).toBeVisible()
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '내 여행', exact: true })
    .click()
}

// Follow the visible primary menu and its view controls.
export async function openWorkspace(page: Page, name: string) {
  const preparation: Record<string, string> = {
    '여행 준비': '요약',
    예약: '예약',
    준비물: '준비물',
    자료: '자료',
  }
  const planning: Record<string, string> = {
    일정: '일정 목록',
    동선: '지도·동선',
    이동시간: '이동시간',
  }
  const primary = preparation[name]
    ? '여행 준비'
    : planning[name]
      ? '일정'
      : name
  await page
    .getByRole('tablist', { name: '여행 관리', exact: true })
    .getByRole('tab', { name: primary, exact: true })
    .click()
  if (preparation[name])
    await page
      .getByRole('group', { name: '준비 관리', exact: true })
      .getByRole('button', { name: preparation[name], exact: true })
      .click()
  if (planning[name])
    await page
      .getByRole('group', { name: '일정 보기', exact: true })
      .getByRole('button', { name: planning[name], exact: true })
      .click()
}
