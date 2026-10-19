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
  if (
    name === '준비물' &&
    (await page.locator('.preparation-options').count()) &&
    !(await page
      .locator('.preparation-options')
      .evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await page.locator('.preparation-options > summary').click()
  if (planning[name])
    await page
      .getByRole('group', { name: '일정 보기', exact: true })
      .getByRole('button', { name: planning[name], exact: true })
      .click()
}

export async function openScheduleEditor(page: Page) {
  const toggle = page.getByRole('button', {
    name: '일정 목록 편집',
    exact: true,
  })
  if ((await toggle.getAttribute('aria-pressed')) !== 'true')
    await toggle.click()
}
export async function openScheduleFilters(page: Page) {
  const panel = page.locator('.timeline-find')
  if (
    (await panel.count()) &&
    !(await panel.evaluate((el) => (el as HTMLDetailsElement).open))
  )
    await panel.locator(':scope > summary').click()
}
