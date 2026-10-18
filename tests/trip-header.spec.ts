import { test, expect } from '@playwright/test'
import { openTrips, openWorkspace } from './navigation'

test('네 여행 화면의 제목·바로가기 위치 고정과 기록 보존', async ({
  page,
}, info) => {
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
            id: 'fixed-header',
            title: '동행자와 함께하는 오사카와 교토의 오래 기억할 자유여행',
            cityId: 'osaka',
            startDate: '2026-12-01',
            endDate: '2026-12-02',
            travelers: 3,
            days: [
              [
                {
                  id: 'castle',
                  placeId: 'osaka-castle',
                  time: '10:00',
                  note: '내 메모 보존',
                },
              ],
              [],
            ],
          },
        ],
      }),
    ),
  )
  await page.reload()
  await openTrips(page)
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips,
  )
  const back = page.getByRole('button', { name: '이전 여행 화면', exact: true })
  await expect(back).toHaveCount(0)
  for (const width of [320, 393, 655, 700, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    let baseline: unknown
    for (const view of ['일정', '여행 중', '여행 준비', '가계부']) {
      await openWorkspace(page, view)
      await page.evaluate(async () => {
        await document.fonts.ready
        scrollTo(0, 0)
      })
      const geometry = await page.evaluate(() => {
        const measure = (selector: string) => {
          const el = document.querySelector(selector)!,
            r = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          return {
            x: r.x,
            y: r.y + scrollY,
            width: r.width,
            height: r.height,
            font: s.fontSize,
            display: s.display,
          }
        }
        return [
          '.trip-page-title',
          '.trip-selector',
          '.trip-banner',
          '.trip-header-copy h2',
          '.trip-facts',
          '.trip-find',
          '.trip-edit',
          '.trip-delete',
          '.workspace-tabs',
        ].map(measure)
      })
      baseline ??= geometry
      expect(geometry).toEqual(baseline)
      const [, , , , , searchBox, editBox, deleteBox] = geometry
      expect(searchBox.y).toBe(editBox.y)
      expect(editBox.y).toBe(deleteBox.y)
      expect(searchBox.x).toBeLessThan(editBox.x)
      expect(editBox.x).toBeLessThan(deleteBox.x)
      for (const box of geometry.slice(5, 8)) {
        expect(box.width).toBe(36)
        expect(box.height).toBe(36)
      }
      const facts = await page
        .locator('.trip-facts > span')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect()
            return { y: r.y, bottom: r.bottom }
          }),
        )
      expect(facts[1].y).toBeGreaterThanOrEqual(facts[0].bottom)
      expect(facts[1].y).toBe(facts[2].y)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false)
      await expect(page.locator('.trip-banner h2')).toHaveText(
        original[0].title,
      )
      await expect(page.locator('.trip-facts')).toBeVisible()
    }
  }
  await page.setViewportSize({ width: 320, height: 852 })
  await page.addStyleTag({
    content:
      '.trip-banner h2 {font-size:30px !important} .trip-facts {font-size:20px !important}',
  })
  for (const view of ['여행 중', '여행 준비', '가계부', '일정']) {
    await openWorkspace(page, view)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
  }
  await page.getByRole('button', { name: '여행 내 찾기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '여행 내 찾기' })).toBeVisible()
  await page.keyboard.press('Escape')
  await openWorkspace(page, '여행 중')
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await expect(page.getByLabel('여행 이름', { exact: true })).toHaveValue(
    original[0].title,
  )
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '여행 삭제', exact: true }).click()
  await page.getByRole('button', { name: '돌아가기', exact: true }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(
    page.getByRole('tab', { name: '일정', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips,
    ),
  ).toEqual(original)
  await page.setViewportSize({ width: 393, height: 852 })
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('trip-header.png') })
})
