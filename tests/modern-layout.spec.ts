import { test, expect } from '@playwright/test'
import { openTrips, openWorkspace } from './navigation'

test('긴 이름을 포함한 주요 화면의 메뉴·버튼은 좁은 화면에서도 읽고 누를 수 있음', async ({
  page,
}) => {
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
            id: 'design-check',
            title: '친구와 함께 천천히 걸으며 오래 기억하고 싶은 교토 자유여행',
            cityId: 'kyoto',
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            travelers: 2,
            days: [
              [
                {
                  id: 'temple',
                  placeId: 'kiyomizu',
                  time: '10:00',
                  note: '산책하며 사진 남기기',
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
  await page.evaluate(() => document.fonts.ready)
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const action = page.locator('.home-journey-copy .button')
    const box = await action.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(
      await action.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await openTrips(page)
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const screen of ['일정', '여행 중', '여행 준비', '가계부']) {
      await openWorkspace(page, screen)
      const controls = await page
        .locator(
          '.workspace-tabs > button, .workspace-view-switch > button, .day-tab',
        )
        .evaluateAll((nodes) =>
          nodes
            .filter((el) => (el as HTMLElement).offsetParent !== null)
            .map((el) => {
              const s = getComputedStyle(el),
                r = el.getBoundingClientRect()
              return {
                height: r.height,
                fits: el.scrollWidth <= el.clientWidth + 1,
                horizontal:
                  s.writingMode === 'horizontal-tb' &&
                  s.whiteSpace === 'nowrap',
                font: parseFloat(s.fontSize) * 0.9,
              }
            }),
        )
      for (const control of controls) {
        expect(control.height).toBeGreaterThanOrEqual(44 * 0.9 - 0.1)
        expect(control.fits).toBe(true)
        expect(control.horizontal).toBe(true)
        expect(control.font).toBeGreaterThanOrEqual(10.56)
        expect(control.font / control.height).toBeLessThanOrEqual(0.34)
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
    }
  }
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})

test('여행 입력은 읽기 쉬운 크기와 터치 영역을 유지하고 키보드로 닫힘', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const form = page.getByRole('dialog')
  await page.evaluate(() => document.fonts.ready)
  const fields = await form
    .locator('.field input, .field select')
    .evaluateAll((nodes) =>
      nodes
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({
          font: parseFloat(getComputedStyle(el).fontSize),
          height: el.getBoundingClientRect().height,
        })),
    )
  expect(fields.length).toBeGreaterThanOrEqual(3)
  for (const field of fields) {
    expect(field.font).toBeGreaterThanOrEqual(14.08)
    expect(field.height).toBeGreaterThanOrEqual(44)
  }
  const close = form.getByRole('button', { name: '닫기', exact: true }).first()
  await close.focus()
  await expect(close).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(form).toHaveCount(0)
})
