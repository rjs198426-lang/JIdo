import { openTrips, openWorkspace } from './navigation'
import { test, expect, type Page } from '@playwright/test'
import { routePoints, routeSegments } from '../src/route-map-model'
import type { Stop } from '../src/travel-model'
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4jIAAAAASUVORK5CYII=',
  'base64',
)
const known = (placeId: string, index: number): Stop => ({
  id: `stop-${index}`,
  placeId,
  time: `${String(9 + index).padStart(2, '0')}:00`,
  note: `메모 ${index}`,
})
const custom = (id: string, lat?: number, lng?: number): Stop => ({
  id,
  placeId: `custom-${id}`,
  time: '16:00',
  note: '개인 메모',
  custom: {
    name: id,
    kind: '관광',
    address: '내 주소',
    link: '',
    destinationId: 'kyoto',
    ...(lat !== undefined && lng !== undefined
      ? { coordinates: { lat, lng } }
      : {}),
  },
})
const stops = [
  ...['kiyomizu', 'fushimi', 'nishiki', 'gion', 'kyoto-cafe'].map(known),
  custom('저녁 장소', 35.013, 135.768),
  custom('숙소', 35.016, 135.77),
]
async function seed(page: Page, day: Stop[] = stops) {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: tile,
      headers: { 'Cache-Control': 'public, max-age=604800' },
    }),
  )
  await page.goto('/')
  await page.evaluate(
    (day) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [
            {
              id: 'map-trip',
              title: '내 일본 동선',
              cityId: 'kyoto',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
              travelers: 1,
              days: [
                day,
                [
                  {
                    id: 'tokyo-stop',
                    placeId: 'tokyo-sensoji',
                    time: '10:00',
                    note: '다른 날짜',
                  },
                ],
              ],
            },
          ],
        }),
      ),
    day,
  )
  await page.reload()
  await openTrips(page)
  await mapTab(page)
}
async function mapTab(page: Page) {
  await openWorkspace(page, '동선')
}
async function state(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}

test('앱 내 지도에 7곳 번호·연결선·출처 표시, 핀과 이전·다음으로 장소 선택', async ({
  page,
}, info) => {
  const external: string[] = []
  page.on('request', (r) => {
    if (/(googleapis|photon)/.test(r.url())) external.push(r.url())
  })
  await seed(page)
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(7)
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.leaflet-container')).toHaveCSS(
    'font-family',
    /SUIT/,
  )
  await expect(page.locator('.leaflet-control-zoom-in')).toHaveCSS(
    'font-family',
    /HiKR/,
  )
  for (const family of await page
    .locator('.leaflet-container, .leaflet-control-zoom a')
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).fontFamily),
    )) {
    expect(['HiKR', 'SUIT']).toContain(
      family.split(',')[0].replaceAll(/["']/g, '').trim(),
    )
  }
  expect(await page.locator('.itinerary-map-pin').allTextContents()).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
  ])
  await expect(page.locator('.itinerary-route-line')).toHaveCount(1)
  await expect(page.locator('.leaflet-control-attribution a')).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/copyright',
  )
  await page
    .getByRole('button', { name: '3번 니시키 시장 선택', exact: true })
    .click()
  await expect(
    page.getByRole('article', { name: '지도에서 선택한 장소' }),
  ).toContainText('니시키 시장')
  await expect(
    page.getByRole('button', { name: '3번 니시키 시장 선택', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '다음 장소', exact: true }).click()
  await expect(page.locator('.map-selected-place')).toContainText(
    '기온 시라카와',
  )
  await page.getByRole('button', { name: '이전 장소', exact: true }).click()
  await expect(page.locator('.map-selected-place')).toContainText('니시키 시장')
  expect((await state(page)).days[0].map((s: Stop) => s.id)).toEqual(
    stops.map((s) => s.id),
  )
  expect(external).toEqual([])
  await page
    .locator('.itinerary-map')
    .screenshot({ path: `artifacts/itinerary-map-${info.project.name}.png` })
})

test('지도에서 일정 순서 변경은 번호·선·일정을 함께 바꾸고 메모·시간·다른 날짜 보존', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('button', { name: '3번 니시키 시장 선택', exact: true })
    .click()
  await page
    .getByRole('button', { name: '선택한 장소 순서 뒤로', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '4번 니시키 시장 선택', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const saved = await state(page)
  expect(saved.days[0].map((s: Stop) => s.placeId)).toEqual([
    'kiyomizu',
    'fushimi',
    'gion',
    'nishiki',
    'kyoto-cafe',
    'custom-저녁 장소',
    'custom-숙소',
  ])
  expect(saved.days[0][3]).toEqual(stops[2])
  expect(saved.days[1][0].note).toBe('다른 날짜')
  await page.reload()
  await openTrips(page)
  await expect(
    page.getByRole('button', { name: '4번 니시키 시장 선택', exact: true }),
  ).toBeVisible()
  await openWorkspace(page, '일정')
  expect(await page.locator('.stop-place strong').allTextContents()).toEqual([
    '기요미즈데라',
    '후시미 이나리 신사',
    '기온 시라카와 산책',
    '니시키 시장',
    '히가시야마 찻집 산책',
    '저녁 장소',
    '숙소',
  ])
})

test('좌표 없는 장소는 번호를 유지하고 연결선을 끊으며 위치 입력 후 지도에 반영', async ({
  page,
}) => {
  await seed(page, [stops[0], custom('위치 없는 일정'), stops[1], stops[2]])
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(3)
  expect(await page.locator('.itinerary-map-pin').allTextContents()).toEqual([
    '1',
    '3',
    '4',
  ])
  await expect(page.locator('.itinerary-route-line')).toHaveCount(1)
  await expect(page.locator('.map-missing-count')).toContainText(
    '위치 미지정 1곳',
  )
  await page
    .getByRole('button', {
      name: '2번 위치 없는 일정 지도에서 선택',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: '위치 추가', exact: true }).click()
  await page.getByText('위치 직접 지정', { exact: true }).click()
  await page.getByLabel('장소 위도').fill('35.01')
  await page.getByLabel('장소 경도').fill('135.76')
  await page
    .getByRole('button', { name: '직접 추가한 일정 수정', exact: true })
    .click()
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(4)
  await expect(page.locator('.map-missing-count')).toHaveCount(0)
  await expect(page.locator('.itinerary-route-line')).toHaveCount(1)
})

test('지도 배경 연결 실패·오프라인에도 장소 번호·선·순서 선택 유지', async ({
  page,
  context,
}) => {
  await seed(page)
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.abort(),
  )
  await page.getByRole('button', { name: '전체 동선', exact: true }).click()
  await page.locator('.leaflet-control-zoom-in').click()
  await expect(
    page.getByText('지도 배경 연결 안 됨', { exact: true }),
  ).toBeVisible()
  await context.setOffline(true)
  await page.getByRole('button', { name: '다음 장소', exact: true }).click()
  await expect(page.locator('.map-selected-place')).toContainText(
    '후시미 이나리',
  )
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(7)
  await expect(page.locator('.itinerary-route-line')).toHaveCount(1)
  await context.setOffline(false)
})

test('날짜·화면 전환에서 이전 핀을 제거하고 중복 지도 초기화 없이 재진입', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await seed(page)
  await page
    .getByRole('tablist', { name: '여행 날짜' })
    .getByRole('tab')
    .nth(1)
    .click()
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: '1번 센소지 선택', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.itinerary-route-line')).toHaveCount(0)
  for (let i = 0; i < 2; i++) {
    await openWorkspace(page, '일정')
    await mapTab(page)
    await expect(page.locator('.leaflet-container')).toHaveCount(1)
  }
  expect(errors).toEqual([])
})

test('날짜변경선·중복 위치·기존 백업 장소도 정확한 번호와 짧은 연결 표시', async ({
  page,
}) => {
  const first = custom('동쪽', 30, 179),
    second = custom('서쪽', 30, -179)
  const points = routePoints([first, second])
  expect(points.map((p) => p.lng)).toEqual([179, 181])
  expect(second.custom?.coordinates?.lng).toBe(-179)
  expect(
    routeSegments(routePoints([first, custom('빈 위치'), second])),
  ).toHaveLength(0)
  const restored = {
    ...custom('복원 장소'),
    custom: { ...custom('복원 장소').custom!, catalogPlaceId: 'kiyomizu' },
  }
  expect(routePoints([restored])).toHaveLength(1)
  await seed(page, [first, second, custom('같은 위치', 30, -179)])
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(3)
  await page.getByRole('button', { name: '다음 장소', exact: true }).click()
  await expect(page.locator('.map-selected-place')).toContainText('서쪽')
  await page.getByRole('button', { name: '다음 장소', exact: true }).click()
  await expect(page.locator('.map-selected-place')).toContainText('같은 위치')
})

test('320px 지도·하단 메뉴가 겹치지 않고 마지막 길찾기와 지도 출처가 보임', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(7)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  const attribution = page.locator('.leaflet-control-attribution')
  const box = await attribution.boundingBox(),
    canvas = await page.locator('.itinerary-map-canvas').boundingBox()
  expect(
    box &&
      canvas &&
      box.x >= canvas.x &&
      box.x + box.width <= canvas.x + canvas.width + 1,
  ).toBe(true)
  const last = page.locator('.route-view > a').last()
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  await expect
    .poll(async () => {
      const a = await last.boundingBox(),
        bar = await page.locator('.bottom-nav').boundingBox()
      return !!a && !!bar && a.y + a.height <= bar.y
    })
    .toBe(true)
})
