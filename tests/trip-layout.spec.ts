import { openTrips } from './navigation'
import { test, expect } from '@playwright/test'

test('내 여행을 하나의 틀로 묶고 도시 선택·추가 버튼 정렬과 기능 보존', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'layout-trip',
            title: '오사카와 교토 자유여행',
            cityId: 'osaka',
            startDate: '2026-10-14',
            endDate: '2026-10-16',
            travelers: 2,
            destinations: [
              {
                id: 'osaka',
                name: '오사카',
                country: '일본',
                guideCityId: 'osaka',
              },
              {
                id: 'kyoto',
                name: '교토',
                country: '일본',
                guideCityId: 'kyoto',
              },
            ],
            dayDestinationIds: ['osaka', 'kyoto', 'kyoto'],
            days: [
              [
                {
                  id: 'castle',
                  placeId: 'osaka-castle',
                  time: '10:00',
                  note: '예약 확인',
                },
                {
                  id: 'dinner',
                  placeId: 'osaka-dotonbori',
                  time: '18:00',
                  note: '동행자와 저녁',
                },
              ],
              [],
              [],
            ],
          },
        ],
      }),
    ),
  )
  await page.reload()
  await openTrips(page)
  for (const width of [320, 393, 655, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    await page.evaluate(() => document.fonts.ready)
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const node = document.querySelector(selector)!
        const r = node.getBoundingClientRect()
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          height: r.height,
          border: parseFloat(getComputedStyle(node).borderLeftWidth),
        }
      }
      return {
        outer: rect('.itinerary'),
        city: rect('.day-destination'),
        add: rect('.journey-city-controls > button'),
        sections: [
          '.trip-banner',
          '.workspace-tabs',
          '.day-tabs',
          '.journey-route',
          '.day-content',
          '.trip-overview',
          '.planning-shortcuts',
        ].map(rect),
      }
    })
    expect(Math.abs(boxes.city.y - boxes.add.y)).toBeLessThan(1)
    expect(Math.abs(boxes.city.height - boxes.add.height)).toBeLessThan(1)
    expect(boxes.add.x - boxes.city.right).toBeGreaterThanOrEqual(9)
    expect(boxes.outer.border).toBeGreaterThan(0)
    for (const section of boxes.sections) {
      expect(section.x - boxes.outer.x).toBeGreaterThanOrEqual(12)
      expect(boxes.outer.right - section.right).toBeGreaterThanOrEqual(12)
      expect(section.border).toBe(0)
      expect(Math.abs(section.x - boxes.sections[0].x)).toBeLessThan(1)
    }
    for (let i = 1; i < boxes.sections.length; i++)
      expect(
        boxes.sections[i].y - boxes.sections[i - 1].bottom,
      ).toBeGreaterThanOrEqual(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
  }
  await page.setViewportSize({ width: 393, height: 852 })
  await page.locator('.journey-route').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: `artifacts/trip-layout-${testInfo.project.name}.png`,
  })
  await page.getByRole('button', { name: '도시 추가', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '도시 추가', exact: true }),
  ).toHaveAttribute('aria-expanded', 'true')
  await page.getByLabel('추가할 여행지').selectOption('tokyo')
  await page
    .getByRole('button', { name: '경로에 도시 추가', exact: true })
    .click()
  await expect(
    page.getByLabel('이날의 체류 도시').locator('option:checked'),
  ).toHaveText('도쿄 · 일본')
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(saved.days[0][0].note).toBe('예약 확인')
  expect(saved.days[0]).toHaveLength(2)
  await page.getByLabel('동행자에게 일정 전달', { exact: true }).click()
  await expect(page.getByLabel('동행자에게 전달할 내용')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
})
