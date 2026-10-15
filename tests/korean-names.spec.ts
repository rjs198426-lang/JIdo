import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import translations from '../src/place-name-translations.json' with { type: 'json' }
import { matchesCity, matchesPlace } from '../src/search'
import { currentPlaceName } from '../src/place-names'
import { routePoints } from '../src/route-map-model'
import { stopDetails, type Stop } from '../src/travel-model'
import { openTrips } from './navigation'

async function explore(page: Page) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
}

test('모든 내장 도시·장소는 한글 이름이며 원래 이름으로도 검색 가능', () => {
  expect(places).toHaveLength(847)
  for (const item of [...cities, ...places]) {
    expect(item.name, item.id).toMatch(/[가-힣]/)
    expect(item.name, item.id).not.toMatch(/[A-Za-z\u3040-\u30ff\u4e00-\u9fff]/)
  }
  for (const [id, translation] of Object.entries(translations)) {
    const place = places.find((place) => place.id === id)!
    const city = cities.find((city) => city.id === place.cityId)!
    expect(matchesPlace(place, city, translation.previous), id).toBe(true)
    expect(matchesPlace(place, city, place.name), id).toBe(true)
  }
  for (const city of cities) expect(matchesCity(city, city.english)).toBe(true)
})

test('이름 변경은 알려진 예전 이름에만 적용하고 개인 정보·동명 장소는 보존', () => {
  for (const [id, translation] of Object.entries(translations)) {
    const bundled = places.find((place) => place.id === id)!
    const old = { ...bundled, name: translation.previous, tip: '내가 쓴 메모' }
    expect(currentPlaceName(old, bundled)).toEqual({
      ...old,
      name: bundled.name,
    })
    const renamed = { ...old, name: '내가 정한 이름' }
    expect(currentPlaceName(renamed, bundled)).toBe(renamed)
    const unrelated = { ...old, cityId: 'my-city' }
    expect(currentPlaceName(unrelated, bundled)).toBe(unrelated)
  }
})

test('예전에 목록에서 복사한 장소도 일정과 지도에서 한글로 표시하며 원본은 보존', () => {
  const place = places.find(
    (place) => place.id === 'kyoto-review-b94a619f6326',
  )!
  const stop: Stop = {
    id: 'copied-stop',
    placeId: 'custom-copied',
    time: '10:30',
    note: '우리의 메모',
    custom: {
      name: 'Fushimi Momoyama Castle',
      kind: '관광',
      address: place.address,
      link: '',
      destinationId: 'kyoto',
      catalogPlaceId: place.id,
      coordinates: { lat: place.lat, lng: place.lng },
    },
  }
  const before = structuredClone(stop)
  expect(stopDetails(stop).name).toBe('후시미 모모야마성')
  expect(routePoints([stop])[0]).toMatchObject({
    name: '후시미 모모야마성',
    lat: place.lat,
    lng: place.lng,
  })
  expect(stop).toEqual(before)
  stop.custom!.name = 'My Castle'
  expect(stopDetails(stop).name).toBe('My Castle')
  expect(routePoints([stop])[0].name).toBe('My Castle')
})

test('오프라인 원어 검색 결과·상세는 한글이며 현지 이름은 펼쳐 확인', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await explore(page)
  const search = page.getByLabel('여행지와 장소 검색')
  await search.fill('Fushimi Momoyama Castle')
  await expect(page.locator('.place-card')).toHaveCount(1)
  await expect(page.locator('.place-card-copy strong')).toHaveText(
    '후시미 모모야마성',
  )
  await page
    .getByRole('button', { name: '후시미 모모야마성 자세히 보기', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.place-detail-title')).toHaveText(
    '후시미 모모야마성',
  )
  await expect(
    dialog.getByText('Fushimi Momoyama Castle', { exact: true }),
  ).not.toBeVisible()
  await dialog.getByText('현지 이름 확인', { exact: true }).click()
  await expect(dialog.locator('.place-original-name')).toContainText(
    'Fushimi Momoyama Castle',
  )
})

test('이전 가이드 캐시와 저장한 일정은 한글로 보이고 직접 작성한 이름·메모 유지', async ({
  page,
}) => {
  const city = cities.find((city) => city.id === 'kyoto')!
  const place = places.find(
    (place) => place.id === 'kyoto-review-b94a619f6326',
  )!
  const renamed = places.find(
    (place) => place.id === 'kyoto-review-8fb58dfc216f',
  )!
  const guide = {
    id: city.id,
    scope: 'city',
    city,
    places: [
      { ...place, name: 'Fushimi Momoyama Castle' },
      { ...renamed, name: '우리만의 정원' },
    ],
    sections: [],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-10-14',
    updatedAt: '2026-10-14',
    publishedAt: '2026-10-14',
  }
  const store = {
    version: 1,
    savedCities: ['kyoto'],
    savedPlaces: [place.id],
    trips: [
      {
        id: 'korean-trip',
        cityId: 'kyoto',
        title: '우리 교토 여행',
        startDate: '2026-11-01',
        endDate: '2026-11-01',
        travelers: 1,
        days: [
          [
            {
              id: 'old-place',
              placeId: place.id,
              time: '10:00',
              note: '성 앞에서 만나기',
            },
            {
              id: 'renamed-place',
              placeId: renamed.id,
              time: '11:00',
              note: '',
            },
            {
              id: 'my-stop',
              placeId: 'custom-stop',
              time: '12:00',
              note: '나의 메모',
              custom: {
                name: 'My Favorite Cafe',
                kind: '카페',
                address: 'Kyoto',
                link: '',
                destinationId: 'kyoto',
              },
            },
          ],
        ],
      },
    ],
  }
  await page.goto('/')
  await page.evaluate(
    ({ guide, store }) => {
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          usingServer: true,
          available: [guide],
          retained: [guide],
        }),
      )
      localStorage.setItem('jido-travel-v1', JSON.stringify(store))
    },
    { guide, store },
  )
  await page.reload()
  await openTrips(page)
  await expect(page.locator('.stop-place').nth(0)).toContainText(
    '후시미 모모야마성',
  )
  await expect(page.locator('.stop-place').nth(1)).toContainText(
    '우리만의 정원',
  )
  await expect(page.locator('.stop-place').nth(2)).toContainText(
    'My Favorite Cafe',
  )
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!),
  )
  expect(saved).toEqual(store)
})
