import { test, expect, type Page } from '@playwright/test'
import { tripSchema } from '../src/travel-model'
import { dateAt, today } from '../src/store'
import { places, getPlace } from '../src/data'
import { nativeServicesFixture } from './native-services-fixture'
import {
  metersBetween,
  nearbyDining,
  validLivePosition,
  destinationProgress,
} from '../src/live-location'
import { openTrips, openWorkspace } from './navigation'
function fixture() {
  const start = dateAt(today(), 10)
  return tripSchema.parse({
    id: 'services-trip',
    title: '교토 여행 알림',
    cityId: 'kyoto',
    startDate: start,
    endDate: dateAt(start, 1),
    travelers: 1,
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '',
          note: 'PRIVATE-TRIP-NOTE',
        },
      ],
      [],
    ],
    checklist: [{ id: 'passport', title: '여권', done: false }],
    reservations: [
      {
        id: 'flight',
        title: '출발 항공편',
        kind: '항공',
        date: start,
        time: '10:00',
        reference: 'PRIVATE-BOOKING-123',
        address: '',
        link: '',
        note: 'PRIVATE-RESERVATION-NOTE',
        status: 'confirmed',
      },
    ],
  })
}
async function seed(page: Page) {
  await page.goto('/')
  await page.evaluate(
    (trip) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      ),
    fixture(),
  )
  await page.reload()
}
async function openNativeSettings(page: Page) {
  await nativeServicesFixture(page)
  await seed(page)
  await page.locator('.bottom-nav:visible,.desktop-nav:visible').getByRole('button', { name: '설정', exact: true }).click()
  await page
    .getByRole('button', { name: '여행 알림 설정', exact: true })
    .click()
}
const state = (page: Page) =>
  page.evaluate(() => localStorage.getItem('jido-travel-v1'))
test('권한은 자동 요청하지 않고 사용자가 켠 뒤에만 기기 알림 예약·시간대·끄기 반영', async ({
  page,
}) => {
  await openNativeSettings(page)
  const before = await state(page)
  expect(
    await page.evaluate(
      () =>
        (window as any).serviceCalls.filter(
          (i: any) => i.method === 'requestPermissions',
        ).length,
    ),
  ).toBe(0)
  await page
    .getByRole('button', { name: '여행 알림 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).alarmPending.length))
    .toBe(8)
  const alarms = await page.evaluate(() => (window as any).alarmPending)
  expect(alarms.every((a: any) => a.isExactNotification === false)).toBe(true)
  expect(JSON.stringify(alarms)).not.toContain('PRIVATE-')
  await page.getByRole('checkbox', { name: /예약 확인/ }).check()
  await expect(page.getByLabel('출발 항공편 출발지 시간대')).toHaveValue('')
  await page.getByLabel('출발 항공편 출발지 시간대').selectOption('Asia/Seoul')
  await expect
    .poll(() => page.evaluate(() => (window as any).alarmPending.length))
    .toBe(9)
  await page
    .getByRole('button', { name: '여행 알림 끄기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).alarmPending.length))
    .toBe(0)
  expect(await state(page)).toBe(before)
})
test('알림 거절은 켜짐으로 저장하지 않고 재시도·허용 후 알림 탭은 올바른 여행과 날짜를 엶', async ({
  page,
}) => {
  await openNativeSettings(page)
  await page.evaluate(() => ((window as any).denyAlarm = true))
  await page
    .getByRole('button', { name: '여행 알림 켜기', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText('허용되지 않았어요')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem('jido-reminders-v1') || '{"enabled":false}',
        ).enabled,
    ),
  ).toBe(false)
  await page.evaluate(() => ((window as any).denyAlarm = false))
  await page
    .getByRole('button', { name: '여행 알림 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).alarmPending.length))
    .toBe(8)
  const before = await state(page)
  await page.evaluate(() =>
    (window as any).emitReminder({
      tripId: 'services-trip',
      day: 1,
      workspace: 'checklist',
    }),
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.preparation-checklist')).toBeVisible()
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('jido-view-services-trip')!),
    ),
  ).toEqual({ day: 1, workspace: 'checklist' })
  expect(await state(page)).toBe(before)
})
test('현재 위치는 켤 때만 요청하고 주변 식사·카페를 거리순 표시하며 저장·외부 요청 없이 중단', async ({
  page,
}) => {
  await nativeServicesFixture(page)
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '여행 중')
  const panel = page.getByRole('region', { name: '현재 위치와 주변 장소' }),
    before = await state(page)
  expect(
    await page.evaluate(
      () =>
        (window as any).serviceCalls.filter(
          (i: any) => i.plugin === 'Geolocation',
        ).length,
    ),
  ).toBe(0)
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(1)
  const place = places.find(
    (p) =>
      p.cityId === 'kyoto' &&
      p.category === '맛집' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng),
  )!
  const pos = { lat: place.lat! + 0.00000123, lng: place.lng! + 0.00000123 }
  await page.evaluate((p) => (window as any).emitGPS(p.lat, p.lng, 10), pos)
  await expect(panel.locator('.live-nearby-list li').first()).toContainText(
    place.name,
  )
  const expected = nearbyDining(places, {
    ...pos,
    accuracy: 10,
    timestamp: Date.now(),
  })
  expect(
    await panel.locator('.live-nearby-list strong').allTextContents(),
  ).toEqual(expected.map((i) => i.place.name))
  await expect(panel.getByLabel('다음 장소 이동 상황')).toContainText('직선')
  expect(await state(page)).toBe(before)
  await panel.getByRole('button', { name: '위치 끄기', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(0)
  await expect(panel.locator('.live-nearby-list')).toHaveCount(0)
  await page.evaluate(
    (p) =>
      (window as any).retiredGPSCallback(
        {
          timestamp: Date.now(),
          coords: { latitude: p.lat, longitude: p.lng, accuracy: 10 },
        },
        undefined,
      ),
    pos,
  )
  await expect(panel.locator('.live-nearby-list')).toHaveCount(0)
  expect(await state(page)).toBe(before)
})
test('권한 거절·오래된 GPS·화면 벗어남에서 추적과 안내가 남지 않음', async ({
  page,
}) => {
  await nativeServicesFixture(page)
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '여행 중')
  const panel = page.getByRole('region', { name: '현재 위치와 주변 장소' })
  await page.evaluate(() => ((window as any).denyLocation = true))
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect(panel).toContainText('허용되지 않았어요')
  expect(await page.evaluate(() => (window as any).gpsWatches.size)).toBe(0)
  await page.evaluate(() => ((window as any).denyLocation = false))
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(1)
  await page.evaluate(() => (window as any).emitGPS(35, 135, 10, 120000))
  await expect(panel.locator('.live-nearby-list')).toHaveCount(0)
  await expect(panel).toContainText('최신 위치')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(
    panel.getByRole('button', { name: '현재 위치 켜기', exact: true }),
  ).toBeVisible()
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(1)
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(0)
})
test('거리 판단은 정확도·시각·직선 기준이며 잘못된 GPS나 오래된 값으로 도착·이동을 단정하지 않음', () => {
  const now = Date.now(),
    target = { lat: 35, lng: 135 },
    previous = { lat: 34.99, lng: 135, accuracy: 10, timestamp: now - 10000 },
    current = { lat: 34.995, lng: 135, accuracy: 10, timestamp: now }
  expect(
    destinationProgress(current, previous, target, now)!.movement,
  ).toContain('가까워지고')
  expect(
    destinationProgress(
      previous,
      { ...current, timestamp: now - 20000 },
      target,
      now,
    )!.movement,
  ).toContain('멀어졌어요')
  expect(
    destinationProgress({ ...current, accuracy: 1000 }, previous, target, now)!
      .movement,
  ).toContain('오차가 커서')
  expect(
    destinationProgress(
      { ...current, lat: 35, lng: 135 },
      previous,
      target,
      now,
    )!.movement,
  ).toContain('근처')
  expect(validLivePosition({ ...current, lat: NaN }, now)).toBe(false)
  expect(validLivePosition({ ...current, timestamp: now - 61000 }, now)).toBe(
    false,
  )
  expect(validLivePosition({ ...current, timestamp: now + 6000 }, now)).toBe(
    false,
  )
  expect(
    destinationProgress(
      { ...current, timestamp: now - 120000 },
      previous,
      target,
      now,
    ),
  ).toBeUndefined()
  expect(
    metersBetween({ lat: 0, lng: 179.99 }, { lat: 0, lng: -179.99 }),
  ).toBeLessThan(3000)
  expect(nearbyDining(places, { ...current, lat: 1000 }, now)).toEqual([])
})

test('여행 날짜 수정·삭제 후에는 이전 알림을 남기지 않음', async ({ page }) => {
  await openNativeSettings(page)
  await page
    .getByRole('button', { name: '여행 알림 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).alarmPending.length))
    .toBe(8)
  const first = await page.evaluate(
    () => +(window as any).alarmPending[0].schedule.at,
  )
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  await page.locator('.bottom-nav:visible,.desktop-nav:visible').getByRole('button', { name: '홈', exact: true }).click()
  await openTrips(page)
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByLabel('마지막 날', { exact: true }).fill(dateAt(today(), 13))
  await page.getByLabel('출발일', { exact: true }).fill(dateAt(today(), 12))
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(() => +(window as any).alarmPending[0]?.schedule.at),
    )
    .toBe(first + 2 * 86400000)
  await page.getByRole('button', { name: '여행 삭제', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '여행 삭제', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).alarmPending.length))
    .toBe(0)
})
test('대략적 위치를 허용해도 동작하며 권한 응답이 늦게 와도 화면을 떠난 뒤 추적하지 않음', async ({
  page,
}) => {
  await nativeServicesFixture(page)
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '여행 중')
  const panel = page.getByRole('region', { name: '현재 위치와 주변 장소' })
  await page.evaluate(() => ((window as any).coarseOnly = true))
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(1)
  const place = getPlace('kiyomizu')!
  expect(
    await page.evaluate(
      () =>
        (window as any).serviceCalls
          .filter(
            (i: any) =>
              i.plugin === 'Geolocation' && i.method === 'watchPosition',
          )
          .at(-1).options.enableHighAccuracy,
    ),
  ).toBe(false)
  await page.evaluate((p) => (window as any).emitGPS(p.lat, p.lng, 900), place)
  await expect(panel.getByLabel('다음 장소 이동 상황')).toContainText(
    '오차가 커서',
  )
  await expect(panel.getByLabel('다음 장소 이동 상황')).not.toContainText(
    '근처에 있어요',
  )
  await panel.getByRole('button', { name: '위치 끄기', exact: true }).click()
  await page.evaluate(() => {
    ;(window as any).coarseOnly = false
    ;(window as any).locationPermission = 'prompt'
    ;(window as any).deferLocationPermission = true
  })
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as any).resolveLocationPermission),
    )
    .toBe('function')
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await page.evaluate(() => (window as any).resolveLocationPermission())
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(0)
})

test('Android 앱 상태가 백그라운드로 바뀌면 위치를 중단하고 복귀만으로 다시 켜지 않음', async ({
  page,
}) => {
  await nativeServicesFixture(page)
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '여행 중')
  const panel = page.getByRole('region', { name: '현재 위치와 주변 장소' })
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(1)
  await page.evaluate(() => (window as any).emitAppState(false))
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(0)
  await page.evaluate(() => (window as any).emitAppState(true))
  await expect(
    panel.getByRole('button', { name: '현재 위치 켜기', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => (window as any).gpsWatches.size)).toBe(0)
})

test('천천히 걷는 동안의 작은 이동도 최근 위치와 비교해 가까워짐을 알려줌', async ({
  page,
}) => {
  await nativeServicesFixture(page)
  await page.clock.install()
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '여행 중')
  const panel = page.getByRole('region', { name: '현재 위치와 주변 장소' }),
    target = getPlace('kiyomizu')!
  await panel
    .getByRole('button', { name: '현재 위치 켜기', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).gpsWatches.size))
    .toBe(1)
  for (let step = 0; step < 4; step++) {
    await page.evaluate((p) => (window as any).emitGPS(p.lat, p.lng, 10), {
      lat: target.lat! - 0.01 + step * 0.0001,
      lng: target.lng!,
    })
    if (step < 3) await page.clock.runFor(10000)
  }
  await expect(panel.getByLabel('다음 장소 이동 상황')).toContainText(
    '가까워지고 있어요',
  )
})
