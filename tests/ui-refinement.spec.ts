import { test, expect } from '@playwright/test'
import { openTrips, openWorkspace } from './navigation'
const makeTrip = (id: string, title: string) => ({
  id,
  title,
  cityId: 'guam',
  startDate: '2026-12-22',
  endDate: '2026-12-26',
  travelers: 2,
  days: [
    [
      {
        id: id + '-stop',
        placeId: 'guam-tumon-beach',
        time: '',
        note: '해 질 무렵 산책하고 저녁 먹기',
      },
    ],
    [],
    [],
    [],
    [],
  ],
})
test('일정 내용을 먼저 보여주고 320~1440px에서 읽기·터치·자료를 보존', async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.goto('/')
  await page.evaluate(
    (trips) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({ version: 1, savedCities: [], savedPlaces: [], trips }),
      ),
    [makeTrip('a', '크리스마스 괌 가족여행'), makeTrip('b', '봄 괌 여행')],
  )
  await page.reload()
  await page.evaluate(() => localStorage.setItem('jdo-active-trip-v1', 'a'))
  await openTrips(page)
  const original = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 851 })
    await page.evaluate(() => scrollTo(0, 0))
    await expect(
      page.getByRole('button', { name: '새 여행', exact: true }),
    ).not.toBeVisible()
    await expect(page.locator('.trip-banner h2')).toHaveText(
      '크리스마스 괌 가족여행',
    )
    if (width === 393)
      expect(
        (await page.locator('.stop-card').first().boundingBox())!.y,
      ).toBeLessThan(460)
    for (const selector of [
      '.trip-banner-controls > button',
      '.workspace-tabs button',
      '.workspace-view-switch button',
      '.day-navigation .day-tab',
      '.timeline-day-heading button',
    ]) {
      const sizes = await page.locator(selector).evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { w: r.width, h: r.height }
        }),
      )
      for (const size of sizes) {
        expect(size.w).toBeGreaterThanOrEqual(43.9)
        expect(size.h).toBeGreaterThanOrEqual(43.9)
      }
    }
    const text = await page
      .locator('.schedule-note-preview p')
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        return {
          height: r.height,
          size:
            parseFloat(getComputedStyle(el).fontSize) *
            Number(getComputedStyle(document.getElementById('root')!).zoom),
        }
      })
    expect(text.size).toBeGreaterThanOrEqual(13)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 393)
      await page.screenshot({
        path: info.outputPath('itinerary-393.png'),
        fullPage: true,
      })
    await openWorkspace(page, '준비물')
    await openWorkspace(page, '가계부')
    await openWorkspace(page, '일정')
  }
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(original)
  await page.locator('.trip-library-more > summary').click()
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '모든 여행 보기', exact: true })
    .click()
  await expect(page.locator('.trip-library')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '새 여행', exact: true }),
  ).toBeVisible()
})
test('긴 여행명과 키보드 날짜 이동은 화면에 맞고 내용은 잘리지 않음', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(
    (trip) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      ),
    makeTrip(
      'long',
      '동행자와 함께 천천히 걸으며 오래 기억하고 싶은 크리스마스 괌 자유여행',
    ),
  )
  await page.reload()
  await openTrips(page)
  await page.setViewportSize({ width: 320, height: 851 })
  const title = page.locator('.trip-banner h2')
  expect(
    await title.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
  ).toBe(true)
  const tab = page
    .getByRole('tablist', { name: '여행 날짜', exact: true })
    .getByRole('tab')
    .first()
  await tab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(
    page.getByRole('tab', { name: 'DAY 2 · 12월 23일 (수)', exact: true }),
  ).toBeFocused()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
