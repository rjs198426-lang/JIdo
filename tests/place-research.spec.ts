import { test, expect, type Page } from '@playwright/test'
import { cities, places, reviewedPlaceIds } from '../src/data'
import { guideSchema } from '../src/guide-schema'
import { expandedGuideById } from '../src/expanded-guides'
import blogNotes from '../src/blog-place-notes.json' with { type: 'json' }
import { resortGuideById } from '../src/resort-guides'

async function explore(page: Page) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
}

test('21개 여행권의 조사 자료와 미검증 휴양지 명소를 구분하고 ID 보존', async () => {
  expect(cities).toHaveLength(21)
  expect(reviewedPlaceIds.size).toBe(830)
  expect(new Set(places.map((place) => place.id)).size).toBe(places.length)
  for (const city of cities) {
    const minimum =
      expandedGuideById.has(city.id) || resortGuideById.has(city.id) ? 20 : 50
    const entries = places.filter((place) => place.cityId === city.id)
    expect(entries.length).toBeGreaterThanOrEqual(minimum)
    expect(entries.length).toBeLessThanOrEqual(100)
    expect(
      entries.filter((place) => reviewedPlaceIds.has(place.id)),
    ).toHaveLength(resortGuideById.has(city.id) ? 0 : minimum)
  }
  const reviewed = places.filter((place) => reviewedPlaceIds.has(place.id))
  const positions = new Map<string, string[]>()
  for (const place of reviewed) {
    expect(place.lat).toBeDefined()
    expect(place.lng).toBeDefined()
    const key = `${place.cityId}:${place.lat!.toFixed(5)},${place.lng!.toFixed(5)}`
    positions.set(key, [
      ...(positions.get(key) || []),
      place.english.split(' · ')[0],
    ])
  }
  for (const entries of positions.values())
    if (entries.length > 1)
      // Separate ticketed facilities on floors 52 and 53 of Mori Tower share its footprint.
      expect(entries.sort()).toEqual(['Mori Art Museum', 'Tokyo City View'])
  const bounds: Record<string, number[]> = {
    kyoto: [34.7, 35.5, 135.4, 136],
    bali: [-9, -8, 114.4, 116],
    bangkok: [13.4, 14.1, 100.2, 101],
    santorini: [36.3, 36.6, 25.2, 25.6],
    dubai: [24.5, 26, 54.7, 56.5],
    maldives: [-1, 8, 72, 74],
    tokyo: [35.4, 35.9, 139.3, 140],
    osaka: [34.4, 35, 135.2, 135.8],
    yokohama: [35.2, 35.7, 139.4, 139.85],
    nagoya: [34.8, 35.5, 136.6, 137.4],
    sapporo: [42.6, 43.4, 140.7, 142],
    fukuoka: [33.3, 33.9, 130, 130.7],
    hiroshima: [34.1, 34.7, 132, 133],
    kobe: [34.5, 35, 134.4, 135.5],
    sendai: [37.8, 38.7, 140.2, 141.6],
    taipei: [24.9, 25.3, 121.4, 121.7],
    hongkong: [22.1, 22.6, 113.8, 114.4],
    singapore: [1.2, 1.5, 103.6, 104.1],
    danang: [15.7, 16.2, 107.9, 108.5],
  }
  for (const place of reviewed) {
    const [south, north, west, east] = bounds[place.cityId]
    expect(place.lat, place.name).toBeGreaterThanOrEqual(south)
    expect(place.lat, place.name).toBeLessThanOrEqual(north)
    expect(place.lng, place.name).toBeGreaterThanOrEqual(west)
    expect(place.lng, place.name).toBeLessThanOrEqual(east)
    expect(place.reviewSources?.length).toBeGreaterThan(0)
    for (const source of place.reviewSources!) {
      expect(source.checkedAt).toBe(
        blogNotes.some(
          (note) =>
            note.id === place.id &&
            note.reviewSources.some((review) => review.url === source.url),
        )
          ? '2026-10-16'
          : expandedGuideById.has(place.cityId)
            ? '2026-10-15'
            : '2026-10-14',
      )
      expect(source.url).toMatch(
        /^https:\/\/(en\.wikivoyage\.org\/wiki\/|blog\.naver\.com\/|[a-zA-Z0-9-]+\.tistory\.com\/|github\.com\/wikivoyage\/wikivoyage.github.io\/blob\/)/,
      )
      expect(source.screeningNote).toContain('보증하지 않습니다')
    }
  }
  expect(
    reviewed.filter((place) =>
      place.reviewSources?.some((source) => source.kind === 'visit-review'),
    ),
  ).toHaveLength(18)
  expect(places.filter((place) => place.photoCredit)).toHaveLength(59)
})

test('도시 선택·목록 추가·근교 검색은 인터넷 없이 동작하고 서로의 필터를 보존', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await explore(page)
  const city = page.getByLabel('가볼 만한 곳의 도시')
  await city.selectOption('kyoto')
  await expect(page.locator('.place-card')).toHaveCount(24)
  await page.getByRole('button', { name: /장소 더 보기/ }).click()
  await expect(page.locator('.place-card')).toHaveCount(48)
  await page.getByRole('button', { name: /장소 더 보기/ }).click()
  await expect(page.locator('.place-card')).toHaveCount(52)
  await expect(page.getByRole('button', { name: /장소 더 보기/ })).toHaveCount(
    0,
  )
  await city.selectOption('sendai')
  await expect(page.locator('.place-card')).toHaveCount(24)
  await page.getByLabel('여행지와 장소 검색').fill('야마가타')
  expect(await page.locator('.place-card').count()).toBeGreaterThan(0)
  await expect(page.locator('.place-card').first()).toContainText(
    '근교 · 야마가타',
  )
  await expect(city).toHaveValue('sendai')
  await context.setOffline(false)
})

test('숙소를 관광지와 구분하고 실제 블로그·지도 출처를 장소 상세에서 열 수 있음', async ({
  page,
}) => {
  await page.goto('/')
  await explore(page)
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('maldives')
  await page.getByRole('button', { name: '숙소', exact: true }).click()
  await expect(page.locator('.place-card')).toHaveCount(3)
  await page
    .locator('.place-card')
    .filter({ hasText: '릴리 비치 리조트' })
    .locator('.place-card-copy')
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('사유 리조트')
  await expect(dialog.locator('.place-review-sources')).toContainText(
    '방문 후기',
  )
  await expect(
    dialog.getByRole('link', { name: /신혼여행 9박 10일/ }),
  ).toHaveAttribute('href', 'https://blog.naver.com/janie-0919/224113221448')
  await expect(
    dialog.getByRole('link', { name: /OpenStreetMap/ }),
  ).toHaveAttribute('href', 'https://www.openstreetmap.org/way/150793976')
})

test('이전 소수 장소 캐시로 시작해도 새 추천 50곳과 기존 여행의 장소 출처를 보존', async ({
  page,
}) => {
  const city = cities.find((city) => city.id === 'kyoto')!
  const oldPlace = {
    ...places.find((place) => place.id === 'kiyomizu')!,
    image: '/images/kyoto.jpg',
  }
  delete oldPlace.reviewSources
  delete oldPlace.photoCredit
  const guide = guideSchema.parse({
    id: city.id,
    scope: 'city',
    city,
    places: [oldPlace],
    sections: [],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    publishedAt: '2026-01-01T00:00:00Z',
  })
  await page.addInitScript(
    (guide) =>
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          available: [guide],
          retained: [guide],
          usingServer: true,
        }),
      ),
    guide,
  )
  await page.goto('/')
  await explore(page)
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('kyoto')
  await expect(
    page.getByLabel('가볼 만한 곳의 도시').locator('option:checked'),
  ).toContainText('50곳')
  await page
    .locator('.place-card')
    .filter({ hasText: '기요미즈데라' })
    .locator('.place-card-copy')
    .click()
  await expect(
    page.getByRole('dialog').locator('.place-review-sources'),
  ).toContainText('방문 후기')
  await expect(
    page.getByRole('dialog').locator('.place-review-sources'),
  ).toContainText('여행자 가이드')
})

test('긴 장소 이름과 근교 표시가 함께 있어도 320px에서 같은 행의 카드 정렬 유지', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')
  await explore(page)
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('sendai')
  await page.evaluate(() => document.fonts.ready)
  const cards = await page.locator('.place-card').evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect()
      const title = node
        .querySelector('.place-card-copy > strong')!
        .getBoundingClientRect()
      return {
        top: box.top,
        height: box.height,
        titleOffset: title.top - box.top,
      }
    }),
  )
  for (const card of cards)
    for (const other of cards.filter(
      (other) => Math.abs(other.top - card.top) < 2,
    )) {
      expect(Math.abs(other.height - card.height)).toBeLessThan(2)
      expect(Math.abs(other.titleOffset - card.titleOffset)).toBeLessThan(2)
    }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
})
