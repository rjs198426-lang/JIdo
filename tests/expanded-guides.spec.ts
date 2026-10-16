import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import { expandedGuides } from '../src/expanded-guides'
import provenance from '../public/expanded-place-sources.json' with { type: 'json' }
import { routePoints } from '../src/route-map-model'
import { tripSchema } from '../src/travel-model'
import { openTrips } from './navigation'

async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}

test('새 여행권마다 고유 장소 20개, 원문 좌표·보관본 날짜·한글 이름을 보존', () => {
  expect(expandedGuides.map((guide) => guide.city.id)).toEqual([
    'taipei',
    'hongkong',
    'singapore',
    'danang',
  ])
  expect(cities).toHaveLength(21)
  expect(places).toHaveLength(887)
  expect(provenance.currentOperationVerified).toBe(false)
  expect(provenance.snapshotDate).toBe('2016-10-27')
  const bounds: Record<string, number[]> = {
    taipei: [24.9, 25.3, 121.4, 121.7],
    hongkong: [22.1, 22.6, 113.8, 114.4],
    singapore: [1.2, 1.5, 103.6, 104.1],
    danang: [15.7, 16.2, 107.9, 108.5],
  }
  for (const guide of expandedGuides) {
    expect(guide.places).toHaveLength(20)
    expect(new Set(guide.places.map((place) => place.name)).size).toBe(20)
    for (const place of guide.places) {
      const source = provenance.places.find((entry) => entry.id === place.id)!
      expect(source, place.name).toBeDefined()
      expect(place.lat).toBe(Number(source.latitude))
      expect(place.lng).toBe(Number(source.longitude))
      const [south, north, west, east] = bounds[place.cityId]
      expect(place.lat).toBeGreaterThanOrEqual(south)
      expect(place.lat).toBeLessThanOrEqual(north)
      expect(place.lng).toBeGreaterThanOrEqual(west)
      expect(place.lng).toBeLessThanOrEqual(east)
      expect(place.name).toMatch(/[가-힣]/)
      expect(place.english).toContain(source.originalName)
      expect(place.reviewSources?.[0].title).toContain('2016년 보관본')
      expect(place.reviewSources?.[0].license).toBe('CC BY-SA 3.0')
      expect(place.photoCredit).toBeUndefined()
      expect(place.image).toBe('/images/place-placeholder.svg')
    }
  }
  const danang = expandedGuides.find((guide) => guide.city.id === 'danang')!
  expect(danang.city.name).toBe('다낭·호이안')
  for (const place of danang.places.filter(
    (place) =>
      provenance.places.find((entry) => entry.id === place.id)
        ?.originalArticle === 'Hoi An',
  )) {
    expect(place.area).toBe('근교 · 호이안')
  }
})

test('새 여행지·20개 장소·이동 가이드는 오프라인으로 읽고 원래 이름으로 검색', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await navigate(page, '여행지')
  await page.getByRole('button', { name: '동아시아', exact: true }).click()
  await expect(page.locator('.city-card')).toHaveCount(2)
  await page
    .getByRole('button', { name: '타이베이 여행지 자세히 보기', exact: true })
    .click()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('tab', { name: '처음 가면', exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('tab', { name: '지역별 코스', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('2016년 보관본')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  for (const guide of expandedGuides) {
    await page.getByLabel('가볼 만한 곳의 도시').selectOption(guide.city.id)
    await expect(page.locator('.place-card')).toHaveCount(20)
  }
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('singapore')
  await page.getByLabel('여행지와 장소 검색').fill('Merlion')
  await expect(page.locator('.place-card')).toHaveCount(1)
  await page
    .getByRole('button', { name: '머라이언 공원 자세히 보기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('2016년 보관본')
  await expect(
    page.getByRole('dialog').getByRole('link', { name: /CC BY-SA 3.0/ }),
  ).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/3.0/')
})

test('새 장소에서 여행을 만들어 재실행해도 장소·일정·지도 좌표를 유지', async ({
  page,
  context,
}) => {
  const place = expandedGuides
    .find((guide) => guide.city.id === 'danang')!
    .places.find((place) => place.name === '미케 해변')!
  await page.goto('/')
  await context.setOffline(true)
  await navigate(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('danang')
  await page
    .getByRole('button', { name: '미케 해변 자세히 보기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  await page
    .getByRole('button', { name: '이 장소와 여행 시작하기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.stop-place')).toContainText('미케 해변')
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!),
  )
  const trip = tripSchema.parse(saved.trips[0])
  expect(trip.cityId).toBe('danang')
  expect(routePoints(trip.days[0])[0]).toMatchObject({
    name: '미케 해변',
    lat: place.lat,
    lng: place.lng,
  })
  // The web test runner serves the app from localhost. Android loads these
  // same assets from its APK, so re-enable localhost navigation for this reload.
  await context.setOffline(false)
  await page.reload()
  await context.setOffline(true)
  await openTrips(page)
  await expect(page.locator('.stop-place')).toContainText('미케 해변')
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].id,
    ),
  ).toBe(trip.id)
})
