import { osmPlaceKind, googlePlaceKind } from '../src/place-categories'
import { test, expect } from '@playwright/test'
import { cities, places, categoryOptions } from '../src/data'
import { balancedPlaces, currentPlaceCategory } from '../src/category-balance'
import { placeCategories } from '../src/place-categories'
import { placeSchema, guideSchema } from '../src/guide-schema'
import { tripSchema, customPlaceSchema } from '../src/travel-model'
import { portableTrip } from '../src/TravelBackup'
import additions from '../src/balanced-places.json' with { type: 'json' }
import updates from '../src/place-category-updates.json' with { type: 'json' }
import research from '../public/category-place-research.json' with { type: 'json' }

const newIds = new Set(additions.map((place) => place.id))

test('21개 여행지마다 관광 외 6개 분류를 제공하고 실물 장소·출처·좌표 누락을 정직하게 유지', () => {
  expect(places).toHaveLength(1066)
  expect(additions).toHaveLength(166)
  expect(updates).toHaveLength(66)
  expect(new Set(places.map((place) => place.id)).size).toBe(places.length)
  expect(places.filter((place) => !newIds.has(place.id))).toHaveLength(900)
  for (const city of cities) {
    const local = places.filter((p) => p.cityId === city.id)
    for (const category of placeCategories)
      expect(
        local.filter((p) => p.category === category).length,
        `${city.name} ${category}`,
      ).toBeGreaterThan(0)
    for (const category of ['맛집', '카페', '숙소'])
      expect(
        local.filter((p) => p.category === category).length,
        `${city.name} ${category}`,
      ).toBeGreaterThanOrEqual(2)
    const first = balancedPlaces(local).slice(0, 7)
    expect(first.map((p) => p.category)).toEqual(placeCategories)
  }
  expect(research.entries).toHaveLength(additions.length)
  for (const place of additions) {
    expect(placeSchema.safeParse(place).success, place.id).toBe(true)
    expect(place.name).toMatch(/^[가-힣\s·]+$/)
    expect(place.image).toBe('/images/place-placeholder.svg')
    expect(place.category).not.toBe('관광')
    const evidence = research.entries.find((r) => r.id === place.id)!
    expect(evidence.source).toEqual(place.reviewSources[0])
    expect(evidence.coordinateBasis).toBeTruthy()
    expect(place.lat === undefined).toBe(place.lng === undefined)
    if (place.lat !== undefined && place.lng !== undefined) {
      expect(Math.abs(place.lat)).toBeGreaterThan(1)
      expect(Math.abs(place.lng)).toBeGreaterThan(1)
    }
    if (evidence.source.kind === 'visit-review') {
      expect(evidence.articleTextLength).toBeGreaterThan(1000)
      expect(evidence.articleTextSHA256).toMatch(/^[a-f0-9]{64}$/)
    } else {
      expect(evidence.source.url).toContain('oldid=')
      expect(evidence.source.license).toBe('CC BY-SA 4.0')
    }
  }
})

test('전체 순환 표시는 원본 순서·같은 분류 내 순서·장소 참조를 보존하고 기존 사용자 분류를 덮어쓰지 않음', () => {
  const before = structuredClone(places)
  const balanced = balancedPlaces(places)
  expect(places).toEqual(before)
  expect(balanced).toHaveLength(places.length)
  for (const category of placeCategories)
    expect(balanced.filter((p) => p.category === category)).toEqual(
      places.filter((p) => p.category === category),
    )
  for (const update of updates) {
    const bundled = places.find((p) => p.id === update.id)!
    const old = {
      ...bundled,
      category: update.previousCategory as typeof bundled.category,
      tip: '개인 메모',
    }
    expect(currentPlaceCategory(old)).toEqual({
      ...old,
      category: update.category,
    })
    expect(old.category).toBe(update.previousCategory)
    const custom = { ...old, category: '숙소' as const }
    expect(currentPlaceCategory(custom)).toBe(custom)
    for (const changed of [
      { ...old, name: '내 장소' },
      { ...old, cityId: 'my-city' },
    ])
      expect(currentPlaceCategory(changed)).toBe(changed)
  }
})

test('쇼핑·체험·바 분류는 직접 등록과 휴대용 여행 백업에서 보존되며 오래된 기타 분류도 허용', () => {
  const local = places.filter((p) => p.cityId === 'kyoto')
  const selected = ['쇼핑', '체험', '바·공연'].map((category) =>
    local.find((p) => p.category === category)!,
  )
  const trip = tripSchema.parse({
    id: 'category-backup',
    title: '분류 보존',
    cityId: 'kyoto',
    startDate: '2026-11-04',
    endDate: '2026-11-04',
    travelers: 1,
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
    ],
    dayDestinationIds: ['kyoto'],
    days: [
      selected.map((p, i) => ({
        id: `stop-${i}`,
        placeId: p.id,
        time: '10:00',
        note: '개인 메모',
      })),
    ],
    reservations: [],
    expenses: [],
    checklist: [],
  })
  const before = structuredClone(trip)
  const restored = tripSchema.parse(
    JSON.parse(JSON.stringify(portableTrip(trip))),
  )
  expect(restored.days[0].map((s) => s.custom?.kind)).toEqual([
    '쇼핑',
    '체험',
    '바·공연',
  ])
  expect(restored.days[0].map((s) => s.note)).toEqual([
    '개인 메모',
    '개인 메모',
    '개인 메모',
  ])
  expect(trip).toEqual(before)
  for (const kind of ['쇼핑', '체험', '바·공연', '기타'])
    expect(
      customPlaceSchema.safeParse({
        name: '내 장소',
        kind,
        address: '',
        link: '',
        destinationId: 'kyoto',
      }).success,
    ).toBe(true)
})

test('오프라인 가이드의 첫 7곳에 모든 분류가 보이고 쇼핑·체험 필터와 출처가 정확히 연결', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/')
  await context.setOffline(true)
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  const section = page.getByRole('region', { name: '가이드 가볼 만한 곳' })
  const group = page.getByRole('group', { name: '가볼 만한 곳 분류' })
  expect(
    await group.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true)
  expect(
    await group.getByRole('button').evaluateAll((nodes) =>
      nodes.every((node) => {
        const r = node.getBoundingClientRect()
        const parent = node.parentElement!.getBoundingClientRect()
        return (
          r.left >= parent.left - 1 &&
          r.right <= parent.right + 1 &&
          r.height >= 44
        )
      }),
    ),
  ).toBe(true)
  const rows = section.locator('.detail-place-list > div')
  const first = await rows
    .locator('> button > span')
    .evaluateAll((nodes) =>
      nodes.slice(0, 7).map((n) => n.textContent!.split(' · ')[0]),
    )
  expect(first).toEqual(placeCategories)
  for (const category of ['쇼핑', '체험']) {
    await group.getByRole('button', { name: category, exact: true }).click()
    await expect(rows).toHaveCount(
      places.filter((p) => p.cityId === 'kyoto' && p.category === category)
        .length,
    )
  }
  const tea = additions.find((p) => p.name === '카멜리아 다도 체험')!
  await section
    .getByRole('button', { name: `${tea.name} 자세히 보기`, exact: true })
    .click()
  await expect(
    page
      .locator('.place-review-sources')
      .getByRole('link', { name: /Wikivoyage/ })
      .first(),
  ).toHaveAttribute('href', tea.reviewSources[0].url)
})

test('이전 관광 분류 캐시에서도 새 추천과 쇼핑을 표시하고 원본 저장 자료와 개인 분류를 보존', async ({
  page,
}) => {
  const city = cities.find((c) => c.id === 'kyoto')!
  const place = places.find((p) => p.id === 'nishiki')!
  const guide = guideSchema.parse({
    id: city.id,
    scope: 'city',
    city,
    places: [{ ...place, category: '관광' }],
    sections: [],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    publishedAt: '2026-01-01',
  })
  const saved = JSON.stringify({
    available: [guide],
    retained: [guide],
    usingServer: true,
  })
  await page.addInitScript(
    (saved) => localStorage.setItem('jdo-guide-catalog-v1', saved),
    saved,
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  const group = page.getByRole('group', { name: '가볼 만한 곳 분류' })
  await group.getByRole('button', { name: '쇼핑', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '가이드 가볼 만한 곳' }),
  ).toContainText('니시키 시장')
  await group.getByRole('button', { name: '숙소', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '가이드 가볼 만한 곳' }),
  ).toContainText('마루후쿠로')
  expect(
    await page.evaluate(() => localStorage.getItem('jdo-guide-catalog-v1')),
  ).toBe(saved)
})

test('무료 장소 검색의 상점·체험·공연도 새 분류로 저장할 수 있고 일반 관광·교통은 유지', () => {
  const cases = [
    ['shop', 'books', '쇼핑'],
    ['amenity', 'marketplace', '쇼핑'],
    ['amenity', 'theatre', '바·공연'],
    ['leisure', 'water_park', '체험'],
    ['tourism', 'theme_park', '체험'],
    ['tourism', 'museum', '관광'],
    ['railway', 'station', '이동'],
  ] as const
  const found = cases.map(([key, value], i) => ({
    name: `테스트 장소 ${i}`,
    kind: osmPlaceKind(key, value),
    address: '',
    link: '',
    coordinates: { lat: 35, lng: 135 },
  }))
  expect(found.map((p) => p.kind)).toEqual(cases.map((c) => c[2]))
  expect(
    [
      'shopping_mall',
      'water_park',
      'performing_arts_theater',
      'museum',
      'train_station',
    ].map((type) => googlePlaceKind([type])),
  ).toEqual(['쇼핑', '체험', '바·공연', '관광', '이동'])
  for (const p of found)
    expect(
      customPlaceSchema.safeParse({
        name: p.name,
        kind: p.kind,
        address: p.address,
        link: p.link,
        coordinates: p.coordinates,
        destinationId: 'kyoto',
      }).success,
    ).toBe(true)
})
