import { test, expect } from '@playwright/test'
import { openTrips } from './navigation'

test('320px와 큰 글자에서도 작업 버튼은 한 줄이며 긴 장소명을 자르지 않음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: ['kyoto'],
        savedPlaces: ['kiyomizu'],
        trips: [
          {
            id: 'compact',
            title: '나와 동행자의 오사카 여행',
            cityId: 'osaka',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            travelers: 2,
            days: [
              [
                {
                  id: 'long-stop',
                  placeId: 'custom-long',
                  time: '10:00',
                  note: '직접 작성한 메모',
                  custom: {
                    name: '오사카에서 동행자와 함께 방문하려고 직접 기록한 아주 긴 장소 이름',
                    kind: '관광',
                    address: 'Osaka Japan',
                    destinationId: 'osaka',
                    link: '',
                  },
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
  await page.addStyleTag({
    content:
      '.workspace-tabs button, .journey-city-controls > button, .planning-shortcuts .button, .planning-shortcuts summary {font-size:16px} .stop-place strong {font-size:20px}',
  })
  const shortActions = page.locator(
    '.workspace-tabs button, .journey-city-controls > button, .planning-shortcuts > .button, .planning-shortcuts summary',
  )
  for (const action of await shortActions.all()) {
    const size = await action.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      whiteSpace: getComputedStyle(el).whiteSpace,
      height: el.getBoundingClientRect().height,
    }))
    expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
    expect(size.whiteSpace).toBe('nowrap')
    expect(size.height).toBeGreaterThanOrEqual(42)
  }
  const title = page.locator('.stop-place strong')
  expect(
    await title.evaluate((el) => ({
      clipped: el.scrollHeight > el.clientHeight,
      overflow: getComputedStyle(el).overflow,
    })),
  ).toEqual({ clipped: false, overflow: 'visible' })
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('button', { name: '추천 장소에서 선택' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  for (const name of [
    '여행 준비',
    '자료',
    '예약',
    '준비물',
    '가계부',
    '일정',
  ]) {
    await page
      .getByRole('tablist', { name: '여행 관리', exact: true })
      .getByRole('tab', { name, exact: true })
      .click()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
  }
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!),
  )
  expect(saved.savedCities).toEqual(['kyoto'])
  expect(saved.savedPlaces).toEqual(['kiyomizu'])
  expect(saved.trips[0].days[0][0].note).toBe('직접 작성한 메모')
  await expect(page.locator('.save-button, .saved-only-toggle')).toHaveCount(0)
})
