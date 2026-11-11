import { getPlace } from '../src/catalog'
import { placeCoordinates } from '../src/place-location'
import { flightTimingIssue } from '../src/reservation-timing'
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { tripSchema, type Trip } from '../src/travel-model'
import { fullManifest, inspectFullBackup } from '../src/full-backup'
import {
  emptySyncSnapshot,
  parseSyncCommit,
  canonicalSnapshot,
} from '../src/sync-model'
import { mergeSyncSnapshots } from '../src/sync-merge'
import { zipSync, strToU8 } from 'fflate'
import { randomUUID } from 'node:crypto'
import { hasReservationDetails } from '../src/reservation-compat'
import { reservationsForDay } from '../src/field-reservations'
const fixture = (): Trip =>
  tripSchema.parse({
    id: 'plan',
    title: '겨울 괌 여행',
    cityId: 'guam',
    startDate: '2026-12-22',
    endDate: '2026-12-26',
    travelers: 2,
    members: [
      { id: 'me', name: '나' },
      { id: 'friend', name: '동행' },
    ],
    days: [
      [
        {
          id: 'beach',
          placeId: 'guam-tumon-beach',
          time: '',
          note: '보존할 메모',
        },
      ],
      [],
      [],
      [],
      [],
    ],
    reservations: [],
    expenses: [],
    checklist: [],
  })
const store = (trips: Trip[]) => ({
  version: 1,
  savedCities: [],
  savedPlaces: [],
  trips,
})
const current = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1') || '{"trips":[]}'),
  )
async function boot(page: Page, trips: Trip[] = []) {
  const outside: string[] = []
  await page.clock.setFixedTime(new Date('2026-11-11T03:00:00Z'))
  await page.addInitScript(
    ({ trips }) => {
      if (!sessionStorage.getItem('planner-seeded')) {
        localStorage.setItem(
          'jido-travel-v1',
          JSON.stringify({
            version: 1,
            savedCities: [],
            savedPlaces: [],
            trips,
          }),
        )
        sessionStorage.setItem('planner-seeded', 'yes')
      }
    },
    { trips },
  )
  await page.route('**/*', (r) => {
    if (r.request().url().startsWith('http://127.0.0.1:')) return r.continue()
    outside.push(r.request().url())
    return r.abort()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'J★Do 홈' }).waitFor()
  return outside
}
const nav = (page: Page, name: string) =>
  page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
async function create(page: Page) {
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const d = page.getByRole('dialog')
  await d.getByLabel('여행 도시', { exact: true }).fill('괌')
  await d.getByLabel('국가', { exact: true }).fill('미국령 괌')
  await d.getByLabel('출발일', { exact: true }).fill('2026-12-22')
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(d).toBeHidden()
}
const rich = () => ({
  ...fixture(),
  reservations: [
    {
      id: 'flight',
      title: '인천에서 괌',
      kind: '항공' as const,
      date: '2026-12-22',
      time: '20:00',
      reference: 'TEST-REF',
      address: '',
      link: '',
      note: '테스트 메모',
      status: 'confirmed' as const,
      flight: {
        airline: '테스트 항공',
        number: 'JD123',
        departureAirport: 'ICN',
        arrivalAirport: 'GUM',
        arrivalDate: '2026-12-23',
        arrivalTime: '02:00',
        departureTimeZone: 'Asia/Seoul',
        arrivalTimeZone: 'Pacific/Guam',
        seat: '12A',
      },
    },
  ],
})

test('guide screens and public-guide requests are absent from all main views', async ({
  page,
}) => {
  const external = await boot(page)
  const menu = page.locator('.bottom-nav:visible,.desktop-nav:visible')
  await expect(menu.getByRole('button')).toHaveText([
    '홈',
    '내 여행',
    '예약',
    '경비',
    '설정',
  ])
  await expect(
    page.getByText(/가이드북|여행 가이드|일본 도시 둘러보기/),
  ).toHaveCount(0)
  await create(page)
  for (const name of ['홈', '내 여행', '예약', '경비', '설정']) {
    await nav(page, name)
    await expect(
      page.getByText(/가이드북|여행 가이드|새 정보 확인|내 주변 맛집/),
    ).toHaveCount(0)
  }
  expect(
    external.filter((url) =>
      /githubusercontent|\/api\/guides|wikipedia|wikimedia/.test(url),
    ),
  ).toEqual([])
})

test('travel creation accepts an arbitrary city, preserves date length and creates no automatic stops', async ({
  page,
}) => {
  await boot(page)
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const d = page.getByRole('dialog')
  await d.getByLabel('여행 도시', { exact: true }).fill('새로운 나의 여행지')
  await d.getByLabel('국가', { exact: true }).fill('나의 목적지 국가')
  await d.getByLabel('출발일', { exact: true }).fill('2026-12-22')
  await expect(d.getByLabel('마지막 날', { exact: true })).toHaveValue(
    '2026-12-25',
  )
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(d).toBeHidden()
  const trip = (await current(page)).trips[0]
  expect(trip.destinations[0]).toMatchObject({
    name: '새로운 나의 여행지',
    country: '나의 목적지 국가',
  })
  expect(trip.destinations[0].guideCityId).toBeUndefined()
  expect(trip.days).toEqual([[], [], [], []])
})

test('structured flight information is stored and restored without automatically creating a schedule', async ({
  page,
}) => {
  await boot(page, [fixture()])
  await nav(page, '예약')
  await page.getByRole('button', { name: '항공편 추가', exact: true }).click()
  const form = page
    .locator('.inline-form')
    .filter({ has: page.getByLabel('예약 이름', { exact: true }) })
  await form
    .getByLabel('예약 이름', { exact: true })
    .fill('테스트 인천-괌 항공')
  await form.getByLabel('예약 번호', { exact: true }).fill('TEST-REF')
  await form.getByLabel('출발 시간', { exact: true }).fill('20:00')
  await form.getByLabel('항공사', { exact: true }).fill('테스트 항공')
  await form.getByLabel('편명', { exact: true }).fill('JD123')
  await form.getByLabel('출발 공항', { exact: true }).fill('ICN')
  await form.getByLabel('도착 공항', { exact: true }).fill('GUM')
  await form.getByLabel('도착 날짜', { exact: true }).fill('2026-12-23')
  await form.getByLabel('도착 시간', { exact: true }).fill('02:00')
  await form.getByText('시간대·좌석·수하물', { exact: false }).click()
  await form.getByLabel('출발 공항 시간대', { exact: true }).fill('Asia/Seoul')
  await form
    .getByLabel('도착 공항 시간대', { exact: true })
    .fill('Pacific/Guam')
  await form.getByLabel('좌석', { exact: true }).fill('12A')
  await form
    .getByRole('button', { name: '예약 정보 저장', exact: true })
    .click()
  await expect(form).toHaveCount(0)
  const saved = (await current(page)).trips[0]
  expect(saved.days).toEqual(fixture().days)
  expect(saved.reservations[0].flight).toMatchObject(
    rich().reservations[0].flight,
  )
  await page.reload()
  await expect(page.locator('.reservation-list')).toContainText('JD123')
  await expect(page.locator('.reservation-list')).toContainText('12A')
  expect((await current(page)).trips[0].reservations[0].reference).toBe(
    'TEST-REF',
  )
})

test('hotel check-in, check-out, contact and costs save separately; recording an expense cannot double-count', async ({
  page,
}) => {
  await boot(page, [fixture()])
  await nav(page, '예약')
  await page
    .getByRole('button', { name: '호텔 예약 추가', exact: true })
    .click()
  const form = page
    .locator('.inline-form')
    .filter({ has: page.getByLabel('예약 이름', { exact: true }) })
  await form.getByLabel('예약 이름', { exact: true }).fill('테스트 괌 호텔')
  await form.getByLabel('체크인 시간', { exact: true }).fill('15:00')
  await form.getByLabel('체크아웃 날짜', { exact: true }).fill('2026-12-26')
  await form.getByLabel('체크아웃 시간', { exact: true }).fill('11:00')
  await form.getByLabel('숙소 연락처', { exact: true }).fill('+1 555 0100')
  await form.getByText('비용·결제일', { exact: true }).click()
  await form.getByLabel('예약 비용', { exact: true }).fill('200')
  await form
    .getByRole('combobox', { name: '예약 비용 통화', exact: true })
    .selectOption('USD')
  await form
    .getByRole('button', { name: '예약 정보 저장', exact: true })
    .click()
  await expect(form).toHaveCount(0)
  const first = (await current(page)).trips[0]
  expect(first.reservations[0].stay).toMatchObject({
    checkoutTime: '11:00',
    contact: '+1 555 0100',
  })
  expect(first.expenses).toEqual([])
  const record = page.getByRole('button', {
    name: '테스트 괌 호텔 지출로 기록',
    exact: true,
  })
  await record.click()
  await expect(record).toBeDisabled()
  expect((await current(page)).trips[0].expenses).toHaveLength(1)
  await nav(page, '경비')
  await expect(
    page.getByRole('tab', { name: '정산', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: '정산', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '동행인 간 정산', exact: true }),
  ).toBeVisible()
})

test('old guide-origin schedule entries remain editable with their name, coordinates, note and identity preserved', async ({
  page,
}) => {
  await boot(page, [fixture()])
  const before = (await current(page)).trips[0]
  await nav(page, '내 여행')
  await page.locator('.stop-expand').first().click()
  await page.locator('.stop-place > button').first().click()
  const d = page.getByRole('dialog')
  await expect(d.getByLabel('장소 또는 일정 이름')).not.toBeEmpty()
  await d.getByRole('button', { name: '저장', exact: true }).click()
  await expect(d).toBeHidden()
  const after = (await current(page)).trips[0].days[0][0]
  expect(after.id).toBe(before.days[0][0].id)
  expect(after.placeId).toBe(before.days[0][0].placeId)
  expect(after.note).toBe('보존할 메모')
  expect(after.custom.coordinates).toEqual(
    placeCoordinates(getPlace(before.days[0][0].placeId)!),
  )
})

test('booking save failure retains the typed flight data and retry saves once', async ({
  page,
}) => {
  await boot(page, [fixture()])
  await nav(page, '예약')
  await page.getByRole('button', { name: '항공편 추가', exact: true }).click()
  await page
    .getByLabel('예약 이름', { exact: true })
    .fill('실패 후 재시도 항공')
  await page.getByLabel('편명', { exact: true }).fill('JD456')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as any).writeOriginal = original
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-travel-v1')
        throw new DOMException('fixture', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page
    .getByRole('button', { name: '예약 정보 저장', exact: true })
    .click()
  await expect(page.getByLabel('편명', { exact: true })).toHaveValue('JD456')
  expect((await current(page)).trips[0].reservations).toEqual([])
  await page.evaluate(() => {
    Storage.prototype.setItem = (window as any).writeOriginal
  })
  await page
    .getByRole('button', { name: '예약 정보 저장', exact: true })
    .click()
  expect((await current(page)).trips[0].reservations).toHaveLength(1)
})

test('new flight and hotel fields round-trip through versioned full backup and sync with an old-client barrier', async () => {
  const trip = rich()
  expect(tripSchema.parse(trip).reservations![0].flight?.seat).toBe('12A')
  expect(hasReservationDetails([trip])).toBe(true)
  const manifest = fullManifest([trip])
  expect(manifest.version).toBe(3)
  expect(manifest.minBuild).toBe(84)
  const archive = zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
  })
  const preview = await inspectFullBackup(
    new File([archive as BlobPart], 'test.zip', { type: 'application/zip' }),
  )
  expect(preview!.manifest.trips[0].reservations![0].flight).toEqual(
    trip.reservations[0].flight,
  )
  const snapshot = emptySyncSnapshot()
  snapshot.store.trips = [trip]
  const commit = parseSyncCommit({
    format: 'jido-drive-sync-v1',
    minBuild: 84,
    id: randomUUID(),
    parents: [],
    createdAt: new Date().toISOString(),
    device: randomUUID(),
    snapshot: canonicalSnapshot(snapshot),
    files: [],
  })
  expect(commit.snapshot.store.trips[0].reservations![0].flight?.seat).toBe(
    '12A',
  )
  const legacySnapshot = emptySyncSnapshot()
  legacySnapshot.store.trips = [fixture()]
  expect(fullManifest([fixture()]).version).toBe(1)
  expect(() => parseSyncCommit({ ...commit, minBuild: 999 })).toThrow()
  const newer = structuredClone(snapshot)
  newer.store.trips[0].reservations![0].flight!.seat = '14B'
  const result = mergeSyncSnapshots(snapshot, snapshot, newer)
  expect(result.snapshot.store.trips[0].reservations![0].flight?.seat).toBe(
    '14B',
  )
  expect(reservationsForDay(trip, 1).map((r) => r.id)).toContain('flight')
})

test('320–1440px core planning views fit and do not recreate guide UI', async ({
  page,
}, info) => {
  await boot(page, [rich()])
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    for (const name of ['홈', '예약', '경비', '설정']) {
      await nav(page, name)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expect(page.getByText('가이드북', { exact: true })).toHaveCount(0)
      if (width === 393)
        await page.screenshot({ path: info.outputPath(`${name}.png`) })
    }
  }
})

test('local dates across the date line are valid and inconsistent zoned flight times are rejected', () => {
  const item = rich().reservations[0]
  expect(
    flightTimingIssue({
      ...item,
      time: '10:00',
      flight: {
        ...item.flight,
        arrivalDate: '2026-12-21',
        arrivalTime: '23:00',
        arrivalTimeZone: 'Pacific/Honolulu',
      },
    }),
  ).toBeUndefined()
  expect(
    flightTimingIssue({
      ...item,
      time: '20:00',
      flight: {
        ...item.flight,
        arrivalDate: '2026-12-22',
        arrivalTime: '20:00',
      },
    }),
  ).toContain('도착 시각')
  expect(
    flightTimingIssue({
      ...item,
      flight: { ...item.flight, arrivalTimeZone: undefined },
    }),
  ).toBeUndefined()
})

test('reservation context switching preserves the previous trip and does not record costs in the wrong trip', async ({
  page,
}) => {
  const first = fixture(),
    second = {
      ...fixture(),
      id: 'another',
      title: '다른 여행',
      reservations: rich().reservations,
    }
  await boot(page, [first, second])
  await nav(page, '예약')
  await page
    .getByLabel('현재 작업의 여행', { exact: true })
    .selectOption('plan')
  await expect(page.locator('.trip-banner h2')).toHaveText(first.title)
  await expect(page.locator('.reservation-list > article')).toHaveCount(0)
  await page
    .getByLabel('현재 작업의 여행', { exact: true })
    .selectOption('another')
  await expect(page.locator('.reservation-list')).toContainText('JD123')
  expect(
    (await current(page)).trips.find((t: Trip) => t.id === 'plan').reservations,
  ).toEqual([])
})
