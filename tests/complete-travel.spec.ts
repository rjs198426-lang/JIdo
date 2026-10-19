import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import { searchTrip } from '../src/trip-search'
import {
  previewTimeAdjustment,
  applyTimeAdjustment,
} from '../src/schedule-adjust'
import { openTrips, openWorkspace, openScheduleEditor } from './navigation'
const ids = [1, 2, 3, 4].map((n) => `${n}1111111-1111-4111-8111-111111111111`)
function fixture(): Trip {
  const file = (
    n: number,
    name: string,
    size: number,
    relation: object = {},
  ) => ({
    id: ids[n],
    name,
    size,
    mimeType: name.endsWith('.jpg') ? 'image/jpeg' : 'text/plain',
    storage: 'browser',
    createdAt: '2026-10-16T00:00:00.000Z',
    ...relation,
  })
  return tripSchema.parse({
    id: 'complete-ten',
    title: '함께 떠나는 교토 여행',
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
          note: '예약표 제시',
          reservationId: 'ticket',
          durationMinutes: 45,
        },
        {
          id: 'inari',
          placeId: 'fushimi',
          time: '11:00',
          note: '땅콩 알레르기 안내',
          durationMinutes: 30,
        },
        { id: 'market', placeId: 'nishiki', time: '13:00', note: '점심 식사' },
      ],
      [
        {
          id: 'cafe',
          placeId: 'custom-cafe',
          time: '12:00',
          note: '창가 자리 메모',
          custom: {
            name: '동행자의 교토 카페',
            address: '京都市下京区',
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
        title: '교토 입장 예약',
        kind: '체험',
        date: '2026-11-01',
        time: '10:00',
        reference: 'LOCAL-77',
        address: '京都市東山区',
        note: '입구에서 제시',
        status: 'confirmed',
        link: '',
      },
    ],
    expenses: [
      {
        id: 'lunch',
        title: '함께 먹은 점심',
        date: '2026-11-01',
        category: '식비',
        amount: 3200,
        currency: 'JPY',
        payer: '동행',
        note: '현금 결제',
      },
    ],
    checklist: [
      {
        id: 'passport',
        title: '여권 사본 챙기기',
        done: false,
        note: '가방 안쪽',
      },
    ],
    attachments: [
      file(0, '교토입장표.txt', 12, { reservationId: 'ticket' }),
      file(1, '카페사진.jpg', 3, { stopId: 'cafe' }),
      file(2, '없는영수증.txt', 4, { expenseId: 'lunch' }),
      file(3, '크기다른메모.txt', 5),
    ],
  })
}
async function seed(page: Page, trip = fixture()) {
  await page.clock.setFixedTime(new Date('2026-11-01T12:00:00'))
  await page.route('https://**', (route) => route.abort())
  await page.goto('/')
  await page.evaluate(
    async ({ trip, ids }) => {
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
        const tx = db.transaction('files', 'readwrite'),
          store = tx.objectStore('files')
        store.put(new Blob(['ticket-bytes'], { type: 'text/plain' }), ids[0])
        store.put(
          new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
          ids[1],
        )
        store.put(new Blob(['x'], { type: 'text/plain' }), ids[3])
        tx.oncomplete = () => resolve()
      })
      db.close()
    },
    { trip, ids },
  )
  await page.reload()
  await openTrips(page)
  await openScheduleEditor(page)
}
const state = (page: Page): Promise<Trip> =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
async function find(page: Page, query: string) {
  await page.getByRole('button', { name: '여행 내 찾기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '여행 내 찾기', exact: true })
  await dialog.getByRole('searchbox', { name: '찾을 내용' }).fill(query)
  return dialog
}
async function searchSelect(page: Page, query: string, title: string) {
  const dialog = await find(page, query)
  await dialog
    .locator('.trip-search-results')
    .getByRole('button', { name: new RegExp(title) })
    .click()
}

test('전체 검색은 메모·예약 번호·파일·준비물·지출과 여러 단어를 로컬 기록에서만 찾음', () => {
  const trip = fixture(),
    before = JSON.stringify(trip)
  expect(searchTrip(trip, '땅콩')[0].target.stopId).toBe('inari')
  expect(searchTrip(trip, 'ＬＯＣＡＬ－７７')[0].target.reservationId).toBe(
    'ticket',
  )
  expect(searchTrip(trip, '교토 입장', '자료')[0].target.attachmentId).toBe(
    ids[0],
  )
  expect(searchTrip(trip, '가방 안쪽')[0].target.checklistId).toBe('passport')
  expect(searchTrip(trip, '현금 결제')[0].target.expenseId).toBe('lunch')
  expect(searchTrip(trip, '')).toEqual([])
  expect(searchTrip(trip, '다른 여행의 기록')).toEqual([])
  expect(JSON.stringify(trip)).toBe(before)
})

test('시간 일괄 변경은 선택한 시각만 바꾸고 메모·첨부·예약·다른 날 보존, 안전한 되돌리기', () => {
  const trip = fixture(),
    change = previewTimeAdjustment(trip, 0, 30, ['inari', 'market']),
    updated = applyTimeAdjustment(trip, change)
  expect(updated.days[0].map((s) => s.time)).toEqual([
    '10:00',
    '11:30',
    '13:30',
  ])
  updated.days[0][1] = { ...updated.days[0][1], note: '나중에 쓴 메모' }
  const restored = applyTimeAdjustment(updated, change, true)
  expect(restored.days[0][1].time).toBe('11:00')
  expect(restored.days[0][1].note).toBe('나중에 쓴 메모')
  expect(restored.attachments).toEqual(trip.attachments)
  expect(restored.reservations).toEqual(trip.reservations)
  expect(restored.days[1]).toEqual(trip.days[1])
  expect(() => previewTimeAdjustment(trip, 0, 30, ['temple'])).toThrow('예약')
  expect(() => previewTimeAdjustment(trip, 0, 0, ['inari'])).toThrow()
  expect(() => previewTimeAdjustment(trip, 0, 1.5, ['inari'])).toThrow()
  expect(() => previewTimeAdjustment(trip, 0, 721, ['inari'])).toThrow()
  expect(() => previewTimeAdjustment(trip, 0, 30, ['unknown'])).toThrow()
  expect(() => previewTimeAdjustment(trip, 0, 30, ['inari', 'inari'])).toThrow()
  const late = fixture()
  late.days[0][1].time = '23:50'
  expect(() => previewTimeAdjustment(late, 0, 30, ['inari'])).toThrow('날짜')
  const concurrent = applyTimeAdjustment(trip, change)
  concurrent.days[0][1] = { ...concurrent.days[0][1], time: '12:20' }
  expect(() => applyTimeAdjustment(concurrent, change, true)).toThrow(
    '일정이 바뀌어',
  )
  const relocated = applyTimeAdjustment(trip, change)
  relocated.days[0][1] = { ...relocated.days[0][1], placeId: 'gion' }
  expect(() => applyTimeAdjustment(relocated, change, true)).toThrow(
    '일정이 바뀌어',
  )
  const booked = applyTimeAdjustment(trip, change)
  booked.days[0][1] = { ...booked.days[0][1], reservationId: 'ticket' }
  expect(() => applyTimeAdjustment(booked, change, true)).toThrow()
})

test('검색 결과로 다른 날·같은 화면의 장소와 준비물을 찾아가며 원래 기록 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await state(page)
  await searchSelect(page, '창가 자리', '동행자의 교토 카페')
  await expect(page.locator('[data-stop-id="cafe"]')).toBeFocused()
  await expect(page.getByLabel('일정 날짜 바로 이동')).toHaveValue('1')
  await searchSelect(page, '땅콩', '후시미 이나리 신사')
  await expect(page.locator('[data-stop-id="inari"]')).toBeFocused()
  await expect(page.getByLabel('일정 날짜 바로 이동')).toHaveValue('0')
  await searchSelect(page, '가방 안쪽', '여권 사본 챙기기')
  await expect(page.locator('[data-checklist-id="passport"]')).toBeFocused()
  expect(await state(page)).toEqual(before)
})

test('예약·지출·자료 검색은 필터나 통계 화면에 가려진 실제 기록을 열고 파일 확인까지 연결', async ({
  page,
}) => {
  await seed(page)
  await searchSelect(page, 'LOCAL-77', '교토 입장 예약')
  await expect(page.locator('[data-reservation-id="ticket"]')).toBeFocused()
  await page.getByLabel('예약 상태 필터').selectOption('취소')
  await searchSelect(page, 'LOCAL-77', '교토 입장 예약')
  await expect(page.locator('[data-reservation-id="ticket"]')).toBeFocused()
  await openWorkspace(page, '가계부')
  await page.getByRole('tab', { name: '통계', exact: true }).click()
  await searchSelect(page, '현금 결제', '함께 먹은 점심')
  await expect(page.locator('[data-expense-id="lunch"]')).toBeFocused()
  await searchSelect(page, '교토입장표', '교토입장표.txt')
  await expect(page.locator(`[data-attachment-id="${ids[0]}"]`)).toBeFocused()
  await page.getByRole('button', { name: '교토입장표.txt 자료 열기' }).click()
  await expect(
    page.getByRole('dialog', { name: '교토입장표.txt 미리보기' }),
  ).toContainText('ticket-bytes')
})

test('검색 분류·빈 결과·30건 이후 더 보기와 닫기 초점 복귀', async ({
  page,
}) => {
  const trip = fixture()
  trip.days[2] = Array.from({ length: 35 }, (_, i) => ({
    id: `record-${i}`,
    placeId: `custom-${i}`,
    time: '14:00',
    note: '보관장소 메모',
    custom: {
      name: `보관장소 ${i + 1}`,
      address: '교토',
      kind: '관광' as const,
      destinationId: 'kyoto',
      link: '',
    },
  }))
  await seed(page, trip)
  const dialog = await find(page, '보관장소')
  await expect(dialog.locator('.trip-search-results > button')).toHaveCount(30)
  await dialog.getByRole('button', { name: '결과 더 보기' }).click()
  await expect(dialog.locator('.trip-search-results > button')).toHaveCount(35)
  await dialog
    .getByRole('group', { name: '여행 검색 분류' })
    .getByRole('button', { name: '예약', exact: true })
    .click()
  await expect(dialog).toContainText('일치하는 기록이 없어요')
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: '여행 내 찾기', exact: true }),
  ).toBeFocused()
})

test('뒤로는 검색·시간 변경 창을 먼저 닫고 이전 여행 화면·날짜·위치를 복구', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('button', { name: '후시미 이나리 신사 지도에서 보기' })
    .evaluate((element) =>
      element.addEventListener('pointerdown', () =>
        sessionStorage.setItem('return-scroll', String(scrollY)),
      ),
    )
  await page
    .getByRole('button', { name: '후시미 이나리 신사 지도에서 보기' })
    .click()
  await expect(
    page
      .getByRole('group', { name: '일정 보기' })
      .getByRole('button', { name: '지도·동선', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await find(page, '메모')
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(
    page.getByRole('dialog', { name: '여행 내 찾기', exact: true }),
  ).toHaveCount(0)
  await expect(
    page
      .getByRole('group', { name: '일정 보기' })
      .getByRole('button', { name: '지도·동선', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(
    page
      .getByRole('group', { name: '일정 보기' })
      .getByRole('button', { name: '일정 목록', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-stop-id="inari"]')).toBeFocused()
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(scrollY - Number(sessionStorage.getItem('return-scroll'))),
      ),
    )
    .toBeLessThan(4)
  await page.getByRole('button', { name: '시간 변경', exact: true }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(
    page.getByRole('dialog', { name: '일정 시간 일괄 변경' }),
  ).toHaveCount(0)
})

test('시간 미리보기 취소는 무변경, 적용·나중 메모·되돌리기에서 예약과 자료 유지', async ({
  page,
}) => {
  await seed(page)
  const original = await state(page)
  await page.getByRole('button', { name: '시간 변경', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '일정 시간 일괄 변경' })
  await expect(dialog.getByLabel('기요미즈데라 시간 변경 선택')).toBeDisabled()
  await expect(dialog).toContainText('11:00 → 11:30')
  expect(await state(page)).toEqual(original)
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  expect(await state(page)).toEqual(original)
  await page.getByRole('button', { name: '시간 변경', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '일정 시간 일괄 변경' })
  await dialog.getByRole('button', { name: '2곳 변경 적용' }).click()
  await expect(page.getByLabel('후시미 이나리 신사 방문 시간')).toHaveValue(
    '11:30',
  )
  const card = page.locator('[data-stop-id="inari"]')
  await card.locator('.stop-edit-details > summary').click()
  await page
    .getByLabel('후시미 이나리 신사 메모', { exact: true })
    .fill('나중에 쓴 메모')
  await page.getByRole('button', { name: '시간 변경 되돌리기' }).click()
  const restored = await state(page)
  expect(restored.days[0][1].time).toBe('11:00')
  expect(restored.days[0][1].note).toBe('나중에 쓴 메모')
  expect(restored.days[0][0]).toEqual(original.days[0][0])
  expect(restored.attachments).toEqual(original.attachments)
  expect(restored.days[1]).toEqual(original.days[1])
})

test('날짜 넘김은 일괄 변경을 막고 다른 시각 수정 후에는 과거 되돌리기를 거부', async ({
  page,
}) => {
  const trip = fixture()
  trip.days[0][1].time = '23:50'
  await seed(page, trip)
  await page.getByRole('button', { name: '시간 변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '일정 시간 일괄 변경' })
  await expect(dialog.getByRole('alert')).toContainText('날짜를 넘는 변경')
  await expect(
    dialog.getByRole('button', { name: '2곳 변경 적용' }),
  ).toBeDisabled()
  await dialog.getByRole('button', { name: '-30분', exact: true }).click()
  await dialog.getByRole('button', { name: '2곳 변경 적용' }).click()
  await page.getByLabel('후시미 이나리 신사 방문 시간').fill('22:00')
  await page.getByRole('button', { name: '시간 변경 되돌리기' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: '일정이 바뀌어' }),
  ).toBeVisible()
  expect((await state(page)).days[0][1].time).toBe('22:00')
})

test('목록에서도 체류시간 15분을 한 자리씩 입력할 수 있음', async ({
  page,
}) => {
  await seed(page)
  await page
    .locator('[data-stop-id="inari"] .stop-edit-details > summary')
    .click()
  const input = page.getByLabel('후시미 이나리 신사 예상 체류 시간')
  await input.fill('')
  await input.pressSequentially('1')
  await expect(input).toHaveValue('1')
  await input.pressSequentially('5')
  await expect(input).toHaveValue('15')
  expect((await state(page)).days[0][1].durationMinutes).toBe(15)
})

test('자료 분류·소속 이름과 기기 파일 확인은 누락·크기 불일치를 알리고 기록을 보존', async ({
  page,
  context,
}) => {
  await seed(page)
  await openWorkspace(page, '자료')
  const before = await state(page)
  await context.setOffline(true)
  await expect(page.locator('.attachment-list')).toContainText('교토 입장 예약')
  await page
    .getByRole('group', { name: '자료 분류' })
    .getByRole('button', { name: '장소', exact: true })
    .click()
  await expect(page.locator('.attachment-list > article')).toHaveCount(1)
  await expect(page.locator('.attachment-list')).toContainText(
    '동행자의 교토 카페',
  )
  await page
    .getByRole('region', { name: '기기 자료 확인' })
    .getByRole('button', { name: '기기 자료 확인', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: '기기 자료 확인' }),
  ).toContainText('파일 존재·크기 확인 2/4개')
  await expect(page.locator('.attachment-check-errors')).toContainText(
    '없는영수증.txt',
  )
  await expect(page.locator('.attachment-check-errors')).toContainText(
    '크기다른메모.txt',
  )
  expect(await state(page)).toEqual(before)
})

test('Android 파일 확인 브리지는 실제 크기를 비교하고 파일 열기·삭제를 호출하지 않음', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.fileChecks = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'Attachments',
          methods: ['checkFile'].map((name) => ({ name, rtype: 'promise' })),
        },
      ],
      nativePromise: (_plugin: string, method: string, options: any) => {
        w.fileChecks.push({ method, options })
        return options.id.startsWith('1')
          ? Promise.resolve({ size: 12 })
          : Promise.reject(new Error('자료 없음'))
      },
    }
  })
  const trip = fixture()
  trip.attachments = trip
    .attachments!.slice(0, 2)
    .map((file) => ({ ...file, storage: 'android' }))
  await seed(page, trip)
  await page.evaluate(
    () => ((window as any).Capacitor.getPlatform = () => 'android'),
  )
  await openWorkspace(page, '자료')
  await page
    .getByRole('button', { name: '기기 자료 확인', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: '기기 자료 확인' }),
  ).toContainText('파일 존재·크기 확인 1/2개')
  expect(
    await page.evaluate(() =>
      (window as any).fileChecks.map((call: any) => call.method),
    ),
  ).toEqual(['checkFile', 'checkFile'])
})

test('320px·큰 글자·작은 높이에서 검색·시간 미리보기와 주요 버튼에 가로 넘침 없음', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 420 })
  await seed(page)
  await page.addStyleTag({
    content: 'button,input,select,summary {font-size:16px !important} ',
  })
  const contrast = await page
    .getByRole('button', { name: '여행 내 찾기', exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element)
      const luminance = (color: string) => {
        const values = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const linear = value / 255
            return linear <= 0.04045
              ? linear / 12.92
              : ((linear + 0.055) / 1.055) ** 2.4
          })
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
      }
      const foreground = luminance(style.color),
        background = luminance(style.backgroundColor)
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      )
    })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await page.locator('.trip-banner').screenshot({
    path: `artifacts/complete-controls-${info.project.name}.png`,
  })
  let dialog = await find(page, '교토')
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await expect(
    dialog.getByRole('button', { name: '여행 검색 닫기' }),
  ).toBeInViewport()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '시간 변경', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '일정 시간 일괄 변경' })
  await dialog
    .getByRole('button', { name: '2곳 변경 적용' })
    .scrollIntoViewIfNeeded()
  await expect(
    dialog.getByRole('button', { name: '2곳 변경 적용' }),
  ).toBeInViewport()
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('time-preview-320.png') })
  await page.keyboard.press('Escape')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
})

test('탐색 이력과 검색창은 재시작에 남지 않고 홈으로 시작, 여행 기록은 유지', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '자료')
  await find(page, '교토')
  await page.reload()
  await expect(
    page.getByRole('dialog', { name: '여행 내 찾기', exact: true }),
  ).toHaveCount(0)
  await expect(page.locator('.travel-home')).toBeVisible()
  await openTrips(page)
  await expect(
    page.getByRole('button', { name: '이전 여행 화면', exact: true }),
  ).toHaveCount(0)
  expect((await state(page)).attachments).toEqual(fixture().attachments)
})

test('작성 중인 새 준비물과 수정 초안은 검색 왕복·재시작에 보존하고 저장 전 원본을 바꾸지 않음', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '준비물')
  await page.getByLabel('새 준비물', { exact: true }).fill('전원 어댑터 챙기기')
  await page
    .getByRole('button', { name: '여권 사본 챙기기 준비물 수정' })
    .click()
  await page.getByLabel('준비물 이름', { exact: true }).fill('여권 사본 두 장')
  await page
    .getByRole('textbox', { name: '준비물 메모', exact: true })
    .fill('숙소에도 한 장 보관')
  await searchSelect(page, 'LOCAL-77', '교토 입장 예약')
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(page.getByLabel('새 준비물', { exact: true })).toHaveValue(
    '전원 어댑터 챙기기',
  )
  await expect(page.getByLabel('준비물 이름', { exact: true })).toHaveValue(
    '여권 사본 두 장',
  )
  expect((await state(page)).checklist![0].title).toBe('여권 사본 챙기기')
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '준비물')
  await expect(
    page.getByRole('textbox', { name: '준비물 메모', exact: true }),
  ).toHaveValue('숙소에도 한 장 보관')
  await page
    .getByRole('button', { name: '준비물 수정 저장', exact: true })
    .click()
  expect((await state(page)).checklist![0].title).toBe('여권 사본 두 장')
  await expect(page.getByLabel('새 준비물', { exact: true })).toHaveValue(
    '전원 어댑터 챙기기',
  )
})
