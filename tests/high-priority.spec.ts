import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { googleMapsFixture } from './google-maps-fixture'
import { openTrips, openWorkspace } from './navigation'
import { routeDeparture } from '../src/route-time'
import { tripSchema } from '../src/travel-model'
const base =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/guidebooks/'
const index = JSON.parse(readFileSync('guidebooks/manifest.json', 'utf8'))
const lisbon = index.books.find((b: any) => b.id === 'book-lisbon')
const book = JSON.parse(readFileSync('guidebooks/' + lisbon.file, 'utf8'))
const fixture = () =>
  tripSchema.parse({
    id: 'high',
    title: '교토',
    cityId: 'kyoto',
    startDate: '2026-12-22',
    endDate: '2026-12-22',
    travelers: 1,
    days: [
      [
        {
          id: 'a',
          placeId: 'kiyomizu',
          time: '10:00',
          durationMinutes: 60,
          note: '메모',
        },
        { id: 'b', placeId: 'nishiki', time: '12:00', note: '' },
      ],
    ],
  })
test('현지 방문+체류·자정 넘김·미설정 시간과 시간대·캐시 구분', () => {
  const trip = fixture(),
    previous = trip.days[0][0]
  expect(routeDeparture(trip, 0, previous)?.toISOString()).toBe(
    '2026-12-22T02:00:00.000Z',
  )
  const later = { ...previous, time: '23:30', durationMinutes: 90 }
  expect(routeDeparture(trip, 0, later)?.toISOString()).toBe(
    '2026-12-22T16:00:00.000Z',
  )
  expect(routeDeparture(trip, 0, { ...previous, time: '' })).toBeUndefined()
  expect(
    routeDeparture(trip, 0, { ...previous, durationMinutes: undefined }),
  ).toBeUndefined()
  const unknown = {
    ...trip,
    cityId: 'personal-unknown',
    destinations: [{ id: 'unknown', name: '직접 여행지', country: '미확인' }],
    dayDestinationIds: ['unknown'],
  }
  expect(routeDeparture(unknown, 0, previous)).toBeUndefined()
  const dst = {
    ...trip,
    startDate: '2026-03-29',
    endDate: '2026-03-29',
    cityId: 'personal-paris',
    destinations: [
      {
        id: 'paris',
        name: '파리',
        country: '프랑스',
        timeZone: 'Europe/Paris',
      },
    ],
    dayDestinationIds: ['paris'],
  }
  expect(routeDeparture(dst, 0, { ...previous, time: '02:30' })).toBeUndefined()
})
test('이동수단 저장·실패·재실행과 현지 출발시간 요청 및 변경 재계산', async ({
  page,
}) => {
  await googleMapsFixture(page)
  await page.clock.setFixedTime(new Date('2026-11-04T00:00:00Z'))
  await page.addInitScript((trip) => {
    if (!sessionStorage.getItem('high-seed')) {
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      )
      sessionStorage.setItem('high-seed', '1')
    }
    localStorage.setItem('jdo-content-auto-v1', 'false')
    const write = Storage.prototype.setItem
    ;(window as any).failMode = false
    Storage.prototype.setItem = function (k, v) {
      if (k === 'jido-travel-v1' && (window as any).failMode)
        throw new DOMException('fixture', 'QuotaExceededError')
      return write.call(this, k, v)
    }
  }, fixture())
  await page.goto('/')
  await openTrips(page)
  await openWorkspace(page, '이동시간')
  const mode = page.getByLabel('기요미즈데라에서 니시키 시장 이동수단', {
    exact: true,
  })
  await expect(mode).toHaveValue('walking')
  await page.evaluate(() => ((window as any).failMode = true))
  await mode.selectOption('driving')
  await expect(mode).toHaveValue('walking')
  await page.evaluate(() => ((window as any).failMode = false))
  await mode.selectOption('driving')
  await expect(
    page.getByLabel('기요미즈데라에서 니시키 시장 이동시간', { exact: true }),
  ).toHaveText('9분')
  const calls = await page.evaluate(() => (window as any).googleCalls)
  expect(new Date(calls.at(-1).departureTime).toISOString()).toBe(
    '2026-12-22T02:00:00.000Z',
  )
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '이동시간')
  await expect(mode).toHaveValue('driving')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    s.trips[0].days[0][0].time = '11:00'
    localStorage.setItem('jido-travel-v1', JSON.stringify(s))
  })
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '이동시간')
  await expect(
    page.getByLabel('기요미즈데라에서 니시키 시장 이동시간', { exact: true }),
  ).toHaveText('9분')
  expect(
    new Date(
      await page.evaluate(
        () => (window as any).googleCalls.at(-1).departureTime,
      ),
    ).toISOString(),
  ).toBe('2026-12-22T03:00:00.000Z')
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!),
  )
  expect(JSON.stringify(saved)).not.toContain('durationMillis')
  expect(saved.trips[0].days[0][0].note).toBe('메모')
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    s.trips[0].startDate = '2027-12-22'
    s.trips[0].endDate = '2027-12-22'
    s.trips[0].days[0][1].routePreference.mode = 'transit'
    localStorage.setItem('jido-travel-v1', JSON.stringify(s))
  })
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '이동시간')
  await expect(
    page.getByLabel('기요미즈데라에서 니시키 시장 이동시간', { exact: true }),
  ).toHaveText('날짜 확인')
  expect(await page.evaluate(() => (window as any).googleCalls)).toHaveLength(0)
})
test('미설치 도시 검색에서 검증 실패·재시도 다운로드 후 가이드와 음식 소개 열기', async ({
  page,
}) => {
  let broken = true
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.route(base + '**', (r) =>
    r.fulfill({
      body: broken
        ? 'broken'
        : readFileSync('guidebooks/' + lisbon.file, 'utf8'),
      contentType: 'application/json',
    }),
  )
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByLabel('여행지와 장소 검색').fill('리스본')
  const region = page.getByRole('region', { name: '받을 수 있는 도시 가이드' })
  await expect(region).toContainText('포르투갈')
  await region
    .getByRole('button', { name: '리스본 가이드 받기', exact: true })
    .click()
  await expect(region.getByRole('alert')).toBeVisible()
  expect(
    await page.evaluate(() => localStorage.getItem('jdo-guidebooks-v1')),
  ).toBeNull()
  broken = false
  await region
    .getByRole('button', { name: '리스본 가이드 받기', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('리스본 여행 가이드')
  await dialog.getByRole('tab', { name: '맛집', exact: true }).click()
  await expect(dialog.locator('.guide-food-introduction')).toContainText(
    '바칼라우',
  )
  await expect(dialog).toContainText('식당 목록은 준비 중')
  await expect(
    dialog.getByRole('link', { name: '지도에서 식당 찾기 ↗' }),
  ).toHaveAttribute('href', /google.com\/maps\/search/)
})

test('가이드 받기 중 홈으로 이동하면 다운로드 후 상세를 강제로 열지 않음', async ({
  page,
}) => {
  let finish!: () => void
  const wait = new Promise<void>((resolve) => {
    finish = resolve
  })
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.route(base + '**', async (r) => {
    await wait
    await r.fulfill({
      body: readFileSync('guidebooks/' + lisbon.file, 'utf8'),
      contentType: 'application/json',
    })
  })
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByLabel('여행지와 장소 검색').fill('리스본')
  await page
    .getByRole('button', { name: '리스본 가이드 받기', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '리스본 가이드 받기', exact: true }),
  ).toBeDisabled()
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  finish()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem('jdo-guidebooks-v1') || '{"books":[]}',
          ).books.length,
      ),
    )
    .toBe(1)
  await expect(page.locator('.travel-home')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
