import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const baseline = JSON.parse(
  readFileSync(
    'research/audits/2026-11-17-compact-layout/before-metrics.json',
    'utf8',
  ),
)
const data = {
  version: 1,
  savedCities: [],
  savedPlaces: [],
  trips: [
    {
      id: 'usability-trip',
      title: '12월 괌 여행',
      cityId: 'guam',
      startDate: '2026-12-22',
      endDate: '2026-12-25',
      travelers: 2,
      days: [
        [
          {
            id: 'first',
            placeId: 'guam-tumon-beach',
            time: '',
            note: '해변에서 일몰 보기',
          },
        ],
        [],
        [],
        [],
      ],
      reservations: [
        {
          id: 'flight',
          title: '인천에서 괌',
          kind: '항공',
          date: '2026-12-22',
          time: '20:00',
          reference: 'EXAMPLE',
          address: '',
          link: '',
          note: '',
          status: 'confirmed',
          flight: {
            airline: '예시 항공',
            number: 'JD123',
            departureAirport: 'ICN',
            arrivalAirport: 'GUM',
            arrivalDate: '2026-12-23',
            arrivalTime: '02:00',
          },
        },
      ],
      expenses: [],
      attachments: [],
      checklist: [],
    },
  ],
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 850 })
  await page.clock.setFixedTime(new Date('2026-11-17T03:00:00Z'))
  await page.addInitScript(
    (data) => localStorage.setItem('jido-travel-v1', JSON.stringify(data)),
    data,
  )
  await page.route('**/*', (r) =>
    r.request().url().startsWith('http://127.0.0.1:')
      ? r.continue()
      : r.abort(),
  )
  await page.goto('/')
})
test('Home is at least 20 percent shorter than the same 0.88 fixture, with booking reference in the first viewport', async ({
  page,
}) => {
  await expect(page.locator('.planner-home')).toBeVisible()
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  )
  expect(height).toBeLessThanOrEqual(baseline.home.height * 0.8)
  const reference = (await page
    .locator('.home-booking-reference')
    .boundingBox())!
  expect(reference.y + reference.height).toBeLessThan(
    (await page.locator('.bottom-nav').boundingBox())!.y,
  )
  const quick = page.getByRole('button', { name: '빠른 추가', exact: true })
  expect(await quick.evaluate((el) => getComputedStyle(el).position)).toBe(
    'static',
  )
  expect((await quick.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const lefts = await page
    .locator('.planner-panel:visible')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left))
  expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1)
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!),
    ),
  ).toEqual(data)
})
test('the first itinerary is higher, actions do not float over content, and narrow layouts do not overflow', async ({
  page,
}) => {
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '내 여행', exact: true })
    .click()
  await expect(page.locator('.stop-card')).toBeVisible()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  expect(
    (await page.locator('.stop-card').first().boundingBox())!.y,
  ).toBeLessThan(baseline.schedule.firstStop - 65)
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    const quick = page.getByRole('button', { name: '빠른 추가', exact: true })
    expect(await quick.evaluate((el) => getComputedStyle(el).position)).toBe(
      'static',
    )
    expect((await quick.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!),
    ),
  ).toEqual(data)
})
