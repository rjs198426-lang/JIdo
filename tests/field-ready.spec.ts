import { googleMapsFixture } from './google-maps-fixture'
import { expect, test, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import {
  reservationsForDay,
  reservationDayLabel,
} from '../src/field-reservations'
import { tripReadiness } from '../src/trip-readiness'
import { placeSignature } from '../src/transfer-planning'
import { openTrips, openWorkspace, openDisclosure } from './navigation'
const fileId = 'bbbb1111-1111-4111-8111-111111111111'
function fixture(): Trip {
  const trip = tripSchema.parse({
    id: 'eight-field',
    title: '동행자와 교토 여행',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    travelers: 2,
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '입구에서 티켓 제시',
          durationMinutes: 60,
          reservationId: 'ticket',
        },
        {
          id: 'inari',
          placeId: 'fushimi',
          time: '10:45',
          note: '물 준비',
          durationMinutes: 30,
        },
      ],
      [
        {
          id: 'cafe',
          placeId: 'custom',
          time: '11:00',
          note: '창가 자리',
          custom: {
            name: '위치 확인할 카페',
            address: '京都のカフェ',
            kind: '카페',
            destinationId: 'kyoto',
            link: '',
          },
        },
      ],
      [],
    ],
    reservations: [
      {
        id: 'ticket',
        title: '기요미즈 입장 예약',
        kind: '체험',
        date: '2026-11-01',
        time: '10:00',
        reference: 'PRIVATE-TICKET-123',
        address: '京都市東山区清水1丁目294',
        note: '입구에서 제시',
        link: '',
        status: 'confirmed',
      },
      {
        id: 'flight',
        title: '일정에 안 넣은 항공편',
        kind: '항공',
        date: '2026-11-01',
        time: '18:00',
        reference: 'PRIVATE-FLIGHT',
        address: '간사이 공항',
        note: '',
        link: '',
        status: 'pending',
      },
      {
        id: 'hotel',
        title: '교토 숙소',
        kind: '숙소',
        date: '2026-11-01',
        endDate: '2026-11-02',
        time: '15:00',
        reference: 'HOTEL',
        address: '京都の宿',
        note: '',
        link: '',
        status: 'confirmed',
      },
      {
        id: 'cancelled',
        title: '취소된 투어',
        kind: '체험',
        date: '2026-11-01',
        time: '12:00',
        reference: 'HIDDEN-CANCELLED',
        address: '',
        note: '',
        link: '',
        status: 'cancelled',
      },
    ],
    checklist: [
      {
        id: 'passport',
        title: '여권 확인',
        done: false,
        dueDate: '2026-10-30',
      },
    ],
    attachments: [
      {
        id: fileId,
        name: '입장예약.txt',
        mimeType: 'text/plain',
        size: 24,
        createdAt: '2026-10-16T00:00:00.000Z',
        storage: 'browser',
        reservationId: 'ticket',
      },
    ],
  })
  trip.days[0][1].transfer = {
    fromStopId: 'temple',
    fromPlace: placeSignature(trip.days[0][0]),
    toPlace: placeSignature(trip.days[0][1]),
    minutes: 30,
  }
  return trip
}
async function seed(page: Page, trip = fixture()) {
  await googleMapsFixture(page)
  await page.clock.install({ time: new Date('2026-11-01T12:00:00') })
  await page.route('https://**', (route) => route.abort())
  await page.goto('/')
  await page.evaluate(
    async ({ trip, fileId }) => {
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedPlaces: [],
          savedCities: [],
          trips: [trip],
        }),
      )
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('jido-attachments-v1', 1)
        r.onupgradeneeded = () => r.result.createObjectStore('files')
        r.onsuccess = () => resolve(r.result)
      })
      await new Promise<void>((resolve) => {
        const tx = db.transaction('files', 'readwrite')
        tx.objectStore('files').put(
          new Blob(['PRIVATE LOCAL TICKET TEXT'], { type: 'text/plain' }),
          fileId,
        )
        tx.oncomplete = () => resolve()
      })
      db.close()
    },
    { trip, fileId },
  )
  await page.reload()
  await openTrips(page)
}
async function state(page: Page): Promise<Trip> {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}

test('현장 다음 장소에서 예약 번호·로컬 티켓을 오프라인으로 열고 삭제 없이 확인', async ({
  page,
  context,
}) => {
  await seed(page)
  await openWorkspace(page, '여행 중')
  await context.setOffline(true)
  await page.locator('.field-ticket > summary').click()
  const booking = page.getByRole('article', {
    name: '기요미즈 입장 예약 현장 예약',
  })
  await expect(booking).toContainText('PRIVATE-TICKET-123')
  await expect(
    booking.getByRole('button', { name: '파일 첨부', exact: true }),
  ).toHaveCount(0)
  await expect(booking.getByRole('button', { name: /첨부 삭제/ })).toHaveCount(
    0,
  )
  await booking.getByRole('button', { name: '입장예약.txt 자료 열기' }).click()
  const preview = page.getByRole('dialog', { name: '입장예약.txt 미리보기' })
  await expect(preview).toContainText('PRIVATE LOCAL TICKET TEXT')
  await page.getByRole('button', { name: '자료 미리보기 닫기' }).click()
  await expect(
    booking.getByRole('button', { name: '입장예약.txt 자료 열기' }),
  ).toBeFocused()
  expect((await state(page)).attachments).toEqual(fixture().attachments)
})

test('독립된 당일 예약과 체크아웃을 보여주고 특정 예약 관리로 초점을 이동', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '여행 중')
  await page.locator('.field-day-bookings > summary').click()
  await expect(page.locator('.field-day-bookings')).toContainText(
    '일정에 안 넣은 항공편',
  )
  await expect(page.locator('.field-day-bookings')).not.toContainText(
    '취소된 투어',
  )
  await expect(
    page
      .getByRole('article', { name: '일정에 안 넣은 항공편 현장 예약' })
      .locator('.attachments-panel'),
  ).toHaveCount(0)
  await page
    .getByRole('article', { name: '일정에 안 넣은 항공편 현장 예약' })
    .getByRole('button', { name: '이 예약 관리', exact: true })
    .click()
  await expect(page.locator('[data-reservation-id="flight"]')).toBeFocused()
  await expect(
    page.getByRole('tab', { name: '여행 준비', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await openWorkspace(page, '여행 중')
  await page.getByLabel('현장에서 볼 날짜').selectOption('1')
  await page.locator('.field-day-bookings > summary').click()
  await expect(page.locator('.field-day-bookings')).toContainText(
    '숙소 · 체크아웃일',
  )
  await expect(page.locator('.field-day-bookings')).not.toContainText(
    'PRIVATE-FLIGHT',
  )
  expect((await state(page)).days).toEqual(fixture().days)
})

test('주소 화면은 저장된 주소를 크게 표시하고 복사 실패·닫기·초점 복귀 처리', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '여행 중')
  await page.locator('.field-ticket > summary').click()
  const trigger = page
    .getByRole('article', { name: '기요미즈 입장 예약 현장 예약' })
    .getByRole('button', { name: '주소 크게 보기' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '보여줄 주소' })
  await expect(dialog.locator('.address-display')).toHaveText(
    '京都市東山区清水1丁目294',
  )
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    }),
  )
  await dialog.getByRole('button', { name: '주소 복사', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('복사하지 못했어요')
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) =>
          sessionStorage.setItem('copied-address', value),
      },
    }),
  )
  await dialog.getByRole('button', { name: '주소 복사', exact: true }).click()
  expect(
    await page.evaluate(() => sessionStorage.getItem('copied-address')),
  ).toBe('기요미즈 입장 예약\n京都市東山区清水1丁目294')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('점검 항목에서 해당 예약으로 이동하고 확정 후 항목이 사라짐', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '여행 준비')
  await openDisclosure(page, '.preparation-review')
  await openDisclosure(page, '.preparation-people')
  const readiness = page.getByRole('region', { name: '여행 점검' })
  await readiness.getByRole('button', { name: '예약', exact: true }).click()
  await readiness
    .getByRole('button', { name: /일정에 안 넣은 항공편 · 예약 확정 확인/ })
    .click()
  await expect(page.locator('[data-reservation-id="flight"]')).toBeFocused()
  await page
    .getByLabel('일정에 안 넣은 항공편 예약 상태', { exact: true })
    .selectOption('confirmed')
  await openWorkspace(page, '여행 준비')
  await openDisclosure(page, '.preparation-review')
  await openDisclosure(page, '.preparation-people')
  await expect(readiness).not.toContainText(
    '일정에 안 넣은 항공편 · 예약 확정 확인',
  )
  expect(
    (await state(page)).reservations?.find((item) => item.id === 'flight')
      ?.status,
  ).toBe('confirmed')
  expect((await state(page)).attachments).toEqual(fixture().attachments)
  await readiness.getByRole('button', { name: '준비물', exact: true }).click()
  await readiness.getByRole('button', { name: /여권 확인 · 기한 지남/ }).click()
  await expect(page.locator('[data-checklist-id="passport"]')).toBeFocused()
})

test('위치 미지정·도착 부족 점검은 해당 날짜·장소와 이동 입력으로 바로 연결', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '여행 준비')
  await openDisclosure(page, '.preparation-review')
  await openDisclosure(page, '.preparation-people')
  const readiness = page.getByRole('region', { name: '여행 점검' })
  await readiness.getByRole('button', { name: '일정', exact: true }).click()
  await readiness
    .getByRole('button', { name: /위치 확인할 카페 · 지도 위치 미지정/ })
    .click()
  await expect(page.locator('[data-stop-id="cafe"]')).toBeFocused()
  await expect(
    page.getByRole('tablist', { name: '여행 날짜' }).getByRole('tab').nth(1),
  ).toHaveAttribute('aria-selected', 'true')
  await openWorkspace(page, '여행 준비')
  await openDisclosure(page, '.preparation-review')
  await openDisclosure(page, '.preparation-people')
  await readiness.getByRole('button', { name: '일정', exact: true }).click()
  await readiness
    .getByRole('button', { name: /후시미 이나리 신사 도착 45분 부족/ })
    .click()
  await expect(page.locator('[data-transfer-id="inari"]')).toBeFocused()
  await expect(
    page
      .getByRole('group', { name: '일정 보기' })
      .getByRole('button', { name: '이동시간', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect((await state(page)).days).toEqual(fixture().days)
})

test('점검은 취소·건너뜀·완료·지난 방문을 경고하지 않고 체크아웃일은 별도로 포함', () => {
  const trip = fixture()
  trip.days[1][0].status = 'skipped'
  trip.days[0][1].status = 'done'
  const issues = tripReadiness(trip, '2026-11-02')
  expect(
    issues.some(
      (item) => item.id === 'location-cafe' || item.id === 'late-inari',
    ),
  ).toBe(false)
  expect(issues.some((item) => item.text.includes('취소된 투어'))).toBe(false)
  const bookings = reservationsForDay(trip, 1)
  expect(bookings.map((item) => item.id)).toEqual(['hotel'])
  expect(reservationDayLabel(bookings[0], '2026-11-02')).toBe(
    '숙소 · 체크아웃일',
  )
  expect(reservationDayLabel(bookings[0], '2026-11-03')).toBe(
    '숙소 · 이용일 확인',
  )
  expect(reservationsForDay(trip, 2)).toEqual([])
})

test('500자를 넘는 여행 메모 초안도 준비 화면 이동·재시작 후 그대로 보존', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '여행 준비')
  await openDisclosure(page, '.preparation-review')
  await openDisclosure(page, '.preparation-people')
  await page.locator('.travel-info .tool-heading button').click()
  const note = '동행자에게 전달할 긴 여행 메모입니다. '.repeat(40)
  await page.getByRole('textbox', { name: '여행 메모', exact: true }).fill(note)
  await openWorkspace(page, '예약')
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '여행 준비')
  await openDisclosure(page, '.preparation-review')
  await openDisclosure(page, '.preparation-people')
  await expect(
    page.getByRole('textbox', { name: '여행 메모', exact: true }),
  ).toHaveValue(note)
})

test('320px·큰 글자·작은 높이에서도 현장 예약·주소 닫기·복사가 잘리지 않음', async ({
  page,
}, info) => {
  const trip = fixture()
  trip.reservations![0].address =
    '京都市東山区清水一丁目二百九十四番地 '.repeat(15)
  await page.setViewportSize({ width: 320, height: 420 })
  await seed(page, trip)
  await page.addStyleTag({
    content: 'button,input,select,summary { font-size:16px !important }',
  })
  await openWorkspace(page, '여행 중')
  await page.locator('.field-ticket > summary').click()
  const booking = page.getByRole('article', {
    name: '기요미즈 입장 예약 현장 예약',
  })
  await booking.getByRole('button', { name: '주소 크게 보기' }).click()
  const dialog = page.getByRole('dialog', { name: '보여줄 주소' })
  const close = dialog.getByRole('button', { name: '주소 화면 닫기' })
  await expect(close).toBeInViewport()
  expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(
    44 * 0.9 - 0.1,
  )
  await dialog
    .getByRole('button', { name: '주소 복사', exact: true })
    .scrollIntoViewIfNeeded()
  await expect(
    dialog.getByRole('button', { name: '주소 복사', exact: true }),
  ).toBeInViewport()
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('address-320.png') })
  await page.keyboard.press('Escape')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
})

test('다음 장소에 연결한 예약 시각이 다르면 현장에서 경고하고 원래 기록을 유지', async ({
  page,
}) => {
  const trip = fixture()
  trip.reservations![0].time = '11:30'
  await seed(page, trip)
  await openWorkspace(page, '여행 중')
  await page.locator('.field-ticket > summary').click()
  const booking = page.getByRole('article', {
    name: '기요미즈 입장 예약 현장 예약',
  })
  await expect(booking.getByRole('alert')).toContainText(
    '연결된 일정과 예약 날짜·시간이 달라요',
  )
  await expect(booking).toContainText('체험 · 11:30')
  expect((await state(page)).days[0][0].time).toBe('10:00')
  expect((await state(page)).reservations![0].time).toBe('11:30')
})
