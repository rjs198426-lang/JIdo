import { test, expect } from '@playwright/test'
import { cities } from '../src/data'

test('모든 도시의 준비·정보·관광·맛집을 오프라인에서 읽고 상세 한 번에 닫기', async ({
  page,
  context,
}) => {
  test.setTimeout(120000)
  await page.goto('/')
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await context.setOffline(true)
  for (const city of cities) {
    await page
      .getByRole('button', {
        name: `${city.name} 여행지 자세히 보기`,
        exact: true,
      })
      .click()
    const dialog = page.getByRole('dialog')
    const tabs = dialog.getByRole('tablist', {
      name: '도시 가이드',
      exact: true,
    })
    await expect(
      tabs.getByRole('tab', { name: '준비', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(dialog.locator('.city-guide-article')).toHaveCount(4)
    await dialog.locator('.city-guide-article summary').first().click()
    await expect(
      dialog.locator('.city-guide-article-body').first(),
    ).toBeVisible()
    await tabs.getByRole('tab', { name: '정보', exact: true }).click()
    await expect(dialog.locator('.city-guide-facts')).toContainText(
      city.currency,
    )
    await tabs.getByRole('tab', { name: '관광', exact: true }).click()
    await expect(
      dialog.locator('.detail-place-list > div').first(),
    ).toBeVisible()
    await tabs.getByRole('tab', { name: '맛집', exact: true }).click()
    await expect(
      dialog.getByRole('button', { name: '맛집', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      dialog.locator('.detail-place-list > div').first(),
    ).toBeVisible()
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})

test('홈 바로가기는 선택 날짜의 도시를 열고 여행·날짜·메모를 보존', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'context',
            title:
              '아주 긴 여행 이름이어도 날짜와 도시를 잃지 않는 나의 일본 여행',
            cityId: 'tokyo',
            startDate: '2026-12-01',
            endDate: '2026-12-02',
            travelers: 2,
            destinations: [
              {
                id: 'tokyo',
                name: '도쿄',
                country: '일본',
                guideCityId: 'tokyo',
              },
              {
                id: 'kyoto',
                name: '교토',
                country: '일본',
                guideCityId: 'kyoto',
              },
            ],
            dayDestinationIds: ['tokyo', 'kyoto'],
            days: [
              [],
              [
                {
                  id: 'keep',
                  placeId: 'kiyomizu',
                  time: '10:00',
                  note: '그대로 남겨둘 메모',
                },
              ],
            ],
          },
        ],
      }),
    )
    localStorage.setItem(
      'jido-view-context',
      JSON.stringify({ day: 1, workspace: 'schedule' }),
    )
  })
  await page.reload()
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  await page.getByRole('button', { name: '여행 가이드', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName('교토 여행 가이드')
  await expect(
    dialog.getByRole('tab', { name: '준비', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('heading', { name: '출발 전, 이것부터', exact: true })).toBeVisible()
  const tabs = dialog.getByRole('tablist', { name: '도시 가이드', exact: true })
  await tabs.getByRole('tab', { name: '준비', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(
    tabs.getByRole('tab', { name: '정보', exact: true }),
  ).toBeFocused()
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-view-context')!),
    ),
  ).toEqual({ day: 1, workspace: 'schedule' })
})

// The home combines sightseeing and dining into one city-scoped places list.
test('홈 가볼 곳은 관광·맛집·카페를 한 목록에서 열기', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('jido-travel-v1', JSON.stringify({
    version: 1, savedCities: [], savedPlaces: [], trips: [{
      id: 'compact-home', title: '크리스마스 괌', cityId: 'guam',
      startDate: '2026-12-22', endDate: '2026-12-26', travelers: 2,
      days: [[], [], [], [], []],
    }],
  })))
  await page.reload()
  const stored = await page.evaluate(() => localStorage.getItem('jido-travel-v1'))
  for (const width of [320, 393, 768]) {
    await page.setViewportSize({ width, height: 850 })
    const hero = await page.locator('.home-journey-card').boundingBox()
    const photo = await page.locator('.home-journey-photo').boundingBox()
    expect(photo!.width / hero!.width).toBeCloseTo(.34, 1)
    expect(hero!.height).toBeLessThan(270)
    const summary = await page.locator('.home-status-grid').boundingBox()
    expect(summary!.height).toBeLessThan(115)
    await expect(page.locator('.home-status-caption')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: '이번 여행 바로가기' }).getByRole('button')).toHaveCount(4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('navigation', { name: '이번 여행 바로가기' }).getByRole('button', { name: '가볼 곳', exact: true }).click()
  await expect(page.getByLabel('가볼 만한 곳의 도시')).toHaveValue('guam')
  await expect(page.locator('.explore-place-filters .category-row button.active')).toHaveText('전체')
  for (const category of ['관광', '맛집', '카페'])
    await expect(page.locator('.explore-place-filters').getByRole('button', { name: category, exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('jido-travel-v1'))).toBe(stored)
})
