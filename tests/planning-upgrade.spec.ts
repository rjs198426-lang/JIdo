import { expect, test, type Page } from '@playwright/test'
import { openTrips, openWorkspace } from './navigation'
import { mapQuery, tripSchema, type Trip } from '../src/travel-model'
import {
  placeSignature,
  transferFor,
  transferLegs,
  dayTransferLegs,
  arrivalText,
} from '../src/transfer-planning'
import { companionBackup } from '../src/journey-personal'
import { portableTrip } from '../src/TravelBackup'
function fixture(): Trip {
  return tripSchema.parse({
    id: 'planning-seven',
    title: '나와 동행자의 교토 여행',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 2,
    members: [
      { id: 'me', name: '나' },
      { id: 'friend', name: '동행' },
    ],
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '예약 번호는 따로 보관',
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
        { id: 'market', placeId: 'nishiki', time: '13:00', note: '점심' },
      ],
      [{ id: 'gion', placeId: 'gion', time: '12:00', note: '다른 날 메모' }],
    ],
    reservations: [
      {
        id: 'ticket',
        title: '입장 예약',
        kind: '체험',
        date: '2026-11-01',
        time: '10:00',
        reference: 'PRIVATE-TEST',
        address: '교토',
        link: '',
        note: '예약 메모',
        status: 'confirmed',
      },
    ],
    checklist: [{ id: 'passport', title: '여권', done: false }],
  })
}
async function seed(page: Page, workspace = 'schedule') {
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'))
  await page.route('https://**', (route) => route.abort())
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZgAAAABJRU5ErkJggg==',
        'base64',
      ),
    }),
  )
  await page.goto('/')
  await page.evaluate(
    ({ trip, workspace }) => {
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      )
      localStorage.setItem(
        'jido-view-' + trip.id,
        JSON.stringify({ workspace, day: 0 }),
      )
    },
    { trip: fixture(), workspace },
  )
  await page.reload()
  await openTrips(page)
}
async function state(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}
const transferInput = (page: Page) =>
  page.getByLabel('기요미즈데라에서 후시미 이나리 신사 이동시간', {
    exact: true,
  })

test('상위 메뉴는 4개, 이전 예약 화면 복원과 준비 하위 화면·작성 메모를 왕복해 보존', async ({
  page,
}) => {
  await seed(page, 'reservations')
  await expect(
    page
      .getByRole('tablist', { name: '여행 관리', exact: true })
      .getByRole('tab'),
  ).toHaveText(['일정', '여행 중', '여행 준비', '가계부'])
  await expect(
    page.getByRole('tab', { name: '여행 준비', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(
    page
      .getByRole('group', { name: '준비 관리' })
      .getByRole('button', { name: '예약', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.reservation-list')).toContainText('입장 예약')
  await openWorkspace(page, '준비물')
  await page.getByRole('tab', { name: '일정', exact: true }).click()
  await page.getByRole('tab', { name: '여행 준비', exact: true }).click()
  await expect(
    page
      .getByRole('group', { name: '준비 관리' })
      .getByRole('button', { name: '준비물', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await openWorkspace(page, '여행 준비')
  await page.locator('.travel-info .tool-heading button').click()
  await page
    .getByRole('textbox', { name: '여행 메모', exact: true })
    .fill('택시에서 보여줄 주소를 보관')
  await openWorkspace(page, '예약')
  await openWorkspace(page, '여행 준비')
  await expect(
    page.getByRole('textbox', { name: '여행 메모', exact: true }),
  ).toHaveValue('택시에서 보여줄 주소를 보관')
  await page
    .getByRole('button', { name: '연락처·메모 저장', exact: true })
    .click()
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '여행 준비')
  expect((await state(page)).travelInfo.note).toBe(
    '택시에서 보여줄 주소를 보관',
  )
})

test('지도 선택 장소를 목록에서 바로 찾고 선택·날짜·순서 변경 후 메모와 예약을 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await state(page)
  await page
    .getByRole('button', {
      name: '후시미 이나리 신사 지도에서 보기',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('figure', { name: '일정 순서 Google 지도' }),
  ).toBeVisible()
  await expect(
    page.getByRole('article', { name: '지도에서 선택한 장소' }),
  ).toContainText('후시미 이나리 신사')
  await page
    .getByRole('button', { name: '선택한 장소 일정 보기', exact: true })
    .click()
  const selected = page.locator('[data-stop-id="inari"]')
  await expect(selected).toHaveClass(/stop-selected/)
  await expect(selected).toBeFocused()
  await openWorkspace(page, '동선')
  await expect(
    page.getByRole('article', { name: '지도에서 선택한 장소' }),
  ).toContainText('후시미 이나리 신사')
  await page
    .getByRole('button', { name: '선택한 장소 순서 앞으로', exact: true })
    .click()
  const after = await state(page)
  expect(after.days[0].map((s: { id: string }) => s.id)).toEqual([
    'inari',
    'temple',
    'market',
  ])
  expect(after.days[0].find((s: { id: string }) => s.id === 'temple')).toEqual(
    before.days[0][0],
  )
  expect(after.reservations).toEqual(before.reservations)
  expect(after.days[1]).toEqual(before.days[1])
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(
    page.getByRole('article', { name: '지도에서 선택한 장소' }),
  ).toContainText('기온')
  await page.getByRole('tab', { name: /DAY 1/ }).click()
  await expect(
    page.getByRole('article', { name: '지도에서 선택한 장소' }),
  ).toContainText('후시미 이나리 신사')
})

test('직접 정한 이동·체류 시간으로 도착 부족을 표시하고 재시작·백업에 보존, 빈 값·0분 구분', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '이동시간')
  await expect(transferInput(page)).toHaveValue('')
  await transferInput(page).fill('30')
  await expect(
    page.getByRole('region', { name: '이동시간 확인' }).getByRole('alert'),
  ).toContainText('입력 기준 도착 11:30')
  await expect(
    page.getByRole('region', { name: '이동시간 확인' }).getByRole('alert'),
  ).toContainText('45분 부족')
  expect((await state(page)).days[0][1].time).toBe('10:45')
  await page.reload()
  await openTrips(page)
  await expect(transferInput(page)).toHaveValue('30')
  const dwellInput = page.getByLabel('기요미즈데라 체류 시간', { exact: true })
  await dwellInput.fill('')
  await dwellInput.pressSequentially('1')
  await expect(dwellInput).toHaveValue('1')
  expect((await state(page)).days[0][0].durationMinutes).toBeUndefined()
  await dwellInput.pressSequentially('5')
  await expect(dwellInput).toHaveValue('15')
  expect((await state(page)).days[0][0].durationMinutes).toBe(15)
  await page.getByLabel('기요미즈데라 체류 시간', { exact: true }).fill('30')
  await transferInput(page).fill('0')
  await expect(transferInput(page)).toHaveValue('0')
  await expect(page.locator('.transfer-result').first()).toContainText('10:30')
  const saved = tripSchema.parse(await state(page)),
    restored = tripSchema.parse(portableTrip(saved))
  expect(transferFor(restored.days[0][0], restored.days[0][1])?.minutes).toBe(0)
  await transferInput(page).fill('')
  expect((await state(page)).days[0][1].transfer).toBeUndefined()
  await expect(page.locator('.transfer-result')).toHaveCount(0)
})

test('순서·장소가 바뀌면 이전 구간 시간을 적용하지 않고 좌표 없이는 거리·도로시간을 만들지 않음', () => {
  const trip = fixture(),
    [a, b, c] = trip.days[0]
  b.transfer = {
    fromStopId: a.id,
    fromPlace: placeSignature(a),
    toPlace: placeSignature(b),
    minutes: 30,
  }
  expect(transferLegs([a, b])[0].lateMinutes).toBe(45)
  const reordered = transferLegs([a, c, b])
  expect(reordered[1].stale).toBe(true)
  expect(reordered[1].arrival).toBeUndefined()
  const moved = {
    ...b,
    custom: {
      name: '변경한 장소',
      kind: '관광' as const,
      address: '다른 주소',
      link: '',
      destinationId: 'kyoto',
    },
  }
  expect(transferFor(a, moved)).toBeUndefined()
  expect(transferLegs([a, moved])[0].distance).toBeUndefined()
  expect(
    tripSchema.safeParse({
      ...trip,
      days: [
        [{ ...a, transfer: { ...b.transfer, minutes: -1 } }, b, c],
        trip.days[1],
      ],
    }).success,
  ).toBe(false)
  expect(arrivalText(1510)).toBe('1일 뒤 01:10')
})

test('320px·큰 글자에서도 메뉴·지도 왕복·이동 입력에 가로 넘침과 하단 겹침이 없음', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page.addStyleTag({
    content:
      '.workspace-tabs button,.workspace-view-switch button {font-size:16px !important}',
  })
  for (const name of [
    '동선',
    '이동시간',
    '예약',
    '준비물',
    '자료',
    '가계부',
    '여행 중',
    '일정',
  ]) {
    await openWorkspace(page, name)
    for (const action of await page
      .locator('.workspace-tabs button,.workspace-view-switch button')
      .all()) {
      expect(
        await action.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true)
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await openWorkspace(page, '이동시간')
  await transferInput(page).fill('30')
  await page.screenshot({ path: info.outputPath('transfers-320.png') })
})

test('건너뛴 장소와 취소 예약은 이동 계산에서 제외하고 바뀐 연결에 이전 시간을 재사용하지 않음', () => {
  const trip = fixture(),
    [a, b, c] = trip.days[0]
  c.transfer = {
    fromStopId: b.id,
    fromPlace: placeSignature(b),
    toPlace: placeSignature(c),
    minutes: 20,
  }
  b.status = 'skipped'
  const legs = dayTransferLegs(trip, 0)
  expect(legs).toHaveLength(1)
  expect(legs[0].previous.id).toBe(a.id)
  expect(legs[0].stop.id).toBe(c.id)
  expect(legs[0].stale).toBe(true)
  expect(legs[0].arrival).toBeUndefined()
  trip.reservations![0].status = 'cancelled'
  expect(dayTransferLegs(trip, 0)).toHaveLength(0)
})

test('동행자 파일에는 건너뛴 장소의 주소가 이동시간 서명을 통해 남지 않음', () => {
  const trip = fixture(),
    [a, b, c] = trip.days[0]
  b.custom = {
    name: '공유 제외 장소',
    kind: '관광',
    address: 'SKIPPED-PRIVATE-ADDRESS',
    link: '',
    destinationId: 'kyoto',
  }
  c.transfer = {
    fromStopId: b.id,
    fromPlace: placeSignature(b),
    toPlace: placeSignature(c),
    minutes: 20,
  }
  b.status = 'skipped'
  const text = companionBackup(trip)
  expect(text).not.toContain('SKIPPED-PRIVATE-ADDRESS')
  expect(text).not.toContain('공유 제외 장소')
  const shared = JSON.parse(text).trips[0]
  expect(shared.days[0].map((stop: { id: string }) => stop.id)).toEqual([
    a.id,
    c.id,
  ])
  expect(shared.days[0][1].transfer).toBeUndefined()
})

test('지도는 원래 순서를 보관하고 전체 길찾기에서는 건너뜀·취소 예약을 제외', async ({
  page,
}) => {
  await seed(page)
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('jido-travel-v1')!),
      trip = store.trips[0]
    trip.reservations[0].status = 'cancelled'
    trip.days[0][1].status = 'skipped'
    trip.days[0].push({
      id: 'gion-today',
      placeId: 'gion',
      time: '16:00',
      note: '산책',
    })
    localStorage.setItem('jido-travel-v1', JSON.stringify(store))
  })
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '동선')
  const trip = tripSchema.parse(await state(page))
  await expect(page.locator('.route-stops')).toContainText(
    '예약 취소 · 길찾기 제외',
  )
  await expect(page.locator('.route-stops')).toContainText(
    '건너뜀 · 길찾기 제외',
  )
  const link = page.getByRole('link', { name: /이 순서로 지도에서 길찾기/ })
  const params = new URL((await link.getAttribute('href'))!).searchParams
  expect(params.get('origin')).toBe(mapQuery(trip.days[0][2], trip))
  expect(params.get('destination')).toBe(mapQuery(trip.days[0][3], trip))
  expect(params.get('travelmode')).toBe('transit')
  expect(
    (await state(page)).days[0].map((stop: { id: string }) => stop.id),
  ).toEqual(['temple', 'inari', 'market', 'gion-today'])
})
