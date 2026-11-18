import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const fixture = JSON.parse(
  readFileSync('tests/fixtures/unified-trip.json', 'utf8'),
)
import { openTrips } from './navigation'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 850 })
  await page.clock.setFixedTime(new Date('2026-11-17T03:00:00Z'))
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('unified-seed')) {
      localStorage.setItem('jido-travel-v1', JSON.stringify(data))
      sessionStorage.setItem('unified-seed', 'yes')
    }
  }, fixture)
  await page.route('**/*', (route) =>
    route.request().url().startsWith('http://127.0.0.1:')
      ? route.continue()
      : route.abort(),
  )
  await page.goto('/')
})
test('all five tabs share a readable page heading, aligned surfaces and reachable navigation without changing records', async ({
  page,
}) => {
  let headingSize = ''
  for (const name of ['홈', '내 여행', '예약', '경비', '설정']) {
    await page
      .locator('.bottom-nav')
      .getByRole('button', { name, exact: true })
      .click()
    const heading = page.locator('main h1:visible')
    await expect(heading).toHaveCount(1)
    const size = await heading.evaluate((e) => getComputedStyle(e).fontSize)
    if (!headingSize) headingSize = size
    expect(size).toBe(headingSize)
    expect((await heading.boundingBox())!.x).toBeGreaterThanOrEqual(16)
    for (const width of [320, 393, 768, 1440]) {
      await page.setViewportSize({ width, height: 850 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true)
      const menu = page.locator('.bottom-nav:visible,.desktop-nav:visible')
      for (const button of await menu.getByRole('button').all())
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await page.setViewportSize({ width: 393, height: 850 })
  }
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!),
    ),
  ).toEqual(fixture)
})
test('the trip menu dismisses on Escape/outside and opens the existing edit form without losing the travel record', async ({
  page,
}) => {
  await openTrips(page)
  const menu = page.locator('.trip-actions-menu'),
    toggle = menu.locator('summary')
  await toggle.click()
  await expect(
    menu.getByRole('button', { name: '여행 삭제', exact: true }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).not.toHaveAttribute('open', '')
  await expect(toggle).toBeFocused()
  await toggle.click()
  await page.locator('main h1').click()
  await expect(menu).not.toHaveAttribute('open', '')
  await toggle.click()
  await menu
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('여행 이름', { exact: true })).toHaveValue(
    fixture.trips[0].title,
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(toggle).toBeFocused()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!),
    ),
  ).toEqual(fixture)
})

test('multiple trips keep selection below the page title and the menu returns to the complete trip list', async ({
  page,
}) => {
  const data = {
    ...fixture,
    trips: [
      fixture.trips[0],
      { ...fixture.trips[0], id: 'second', title: '다음 도쿄 여행' },
    ],
  }
  await page.evaluate(
    (data) => localStorage.setItem('jido-travel-v1', JSON.stringify(data)),
    data,
  )
  await page.reload()
  await openTrips(page)
  await page.locator('.trip-actions-menu > summary').click()
  await page
    .getByRole('button', { name: '모든 여행 보기', exact: true })
    .click()
  await expect(page.locator('.trip-library')).toBeVisible()
  await page.locator('[data-trip-id="second"]').click()
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '예약', exact: true })
    .click()
  await expect(page.locator('main h1:visible')).toHaveText('예약')
  const selector = page.getByLabel('현재 작업의 여행', { exact: true })
  await expect(selector).toHaveValue('second')
  expect((await selector.boundingBox())!.y).toBeGreaterThan(
    (await page.locator('main h1:visible').boundingBox())!.y,
  )
  await selector.selectOption('modern-trip')
  await expect(page.locator('.trip-header-copy h2')).toHaveText(
    fixture.trips[0].title,
  )
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!),
    ),
  ).toEqual(data)
})

test('finance subviews reveal their own content and reservation entry removes list controls without changing records', async ({
  page,
}) => {
  const data = structuredClone(fixture)
  Object.assign(data.trips[0], {
    baseCurrency: 'KRW',
    totalBudget: 100000,
    exchangeRates: { USD: 1300 },
    expenses: [
      {
        id: 'meal',
        title: '예시 식사',
        date: '2026-12-22',
        amount: 75,
        currency: 'USD',
        category: '식비',
        payer: '나',
      },
    ],
  })
  await page.evaluate(
    (data) => localStorage.setItem('jido-travel-v1', JSON.stringify(data)),
    data,
  )
  await page.reload()
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '경비', exact: true })
    .click()
  for (const [name, selector] of [
    ['정산', '.settlement-view'],
    ['통계', '.expense-statistics'],
    ['예산', '.expense-budget-panel'],
  ]) {
    await page
      .getByRole('tablist', { name: '가계부 보기' })
      .getByRole('tab', { name, exact: true })
      .click()
    await expect(page.locator(selector)).toBeVisible()
    expect((await page.locator(selector).boundingBox())!.y).toBeLessThan(650)
    expect(
      (await page.locator('.expense-summary-compact').boundingBox())!.height,
    ).toBeLessThan(140)
    const tools = await page.locator('.expense-more').boundingBox()
    expect(tools!.y).toBeGreaterThan(
      (await page.locator(selector).boundingBox())!.y,
    )
  }
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '예약', exact: true })
    .click()
  await page
    .getByRole('button', { name: '호텔 예약 추가', exact: true })
    .click()
  await expect(page.locator('.reservation-edit-page h3')).toHaveText(
    '호텔 예약 추가',
  )
  await expect(page.getByLabel('예약 검색', { exact: true })).toHaveCount(0)
  expect(
    (await page.getByLabel('예약 이름', { exact: true }).boundingBox())!.y,
  ).toBeLessThan(650)
  await page.getByRole('button', { name: '입력 취소', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '호텔 예약 추가', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!),
    ),
  ).toEqual(data)
})
