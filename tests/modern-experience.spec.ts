import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import { parsePlanText, appendPlanLines } from '../src/plan-paste'
import { parseBookingText } from '../src/booking-paste'

const trip = (id = 'modern-trip'): Trip =>
  tripSchema.parse({
    id,
    title:
      id === 'modern-trip'
        ? '처음 가는 겨울 가족 여행 · 괌과 도쿄'
        : '다음 여름 도쿄 여행',
    cityId: 'own-guam',
    startDate: '2026-12-22',
    endDate: '2026-12-24',
    travelers: 2,
    destinations: [
      {
        id: 'own-guam',
        name: '괌',
        country: '미국령 괌',
        timeZone: 'Pacific/Guam',
      },
      {
        id: 'own-tokyo',
        name: '도쿄',
        country: '일본',
        timeZone: 'Asia/Tokyo',
      },
    ],
    dayDestinationIds: ['own-guam', 'own-tokyo', 'own-guam'],
    days: [
      [
        {
          id: 'original',
          placeId: 'custom-original',
          time: '',
          note: '원래 메모 보존',
          custom: {
            name: '해변 산책',
            kind: '관광',
            address: '원래 주소',
            link: '',
            destinationId: 'own-guam',
            coordinates: { lat: 13.5, lng: 144.8 },
          },
        },
      ],
      [],
      [],
    ],
    reservations: [
      {
        id: 'flight',
        title: '예시 항공 괌 도착편',
        kind: '항공',
        date: '2026-12-22',
        time: '20:00',
        reference: 'EXAMPLE123',
        address: '',
        link: '',
        note: '기존 예약 메모',
        status: 'confirmed',
        flight: {
          airline: '예시 항공',
          number: 'JD123',
          departureAirport: 'ICN',
          arrivalAirport: 'GUM',
          arrivalDate: '2026-12-23',
          arrivalTime: '02:00',
        },
      },
    ],
    checklist: [
      {
        id: 'passport',
        title: '여권 유효기간 확인',
        done: false,
        category: '서류',
        note: '',
      },
    ],
    expenses: [],
    attachments: [],
  })
async function boot(page: Page, trips = [trip()]) {
  const outside: string[] = []
  await page.clock.setFixedTime(new Date('2026-11-12T03:00:00Z'))
  await page.addInitScript(
    ({ trips }) => {
      if (!sessionStorage.getItem('modern-seed')) {
        localStorage.setItem(
          'jido-travel-v1',
          JSON.stringify({
            version: 1,
            savedCities: [],
            savedPlaces: [],
            trips,
          }),
        )
        sessionStorage.setItem('modern-seed', 'yes')
      }
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (key, value) {
        if (key === 'jido-travel-v1' && (window as any).failModernSave)
          throw new DOMException('space', 'QuotaExceededError')
        return original.call(this, key, value)
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
const stored = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips as Trip[],
  )
const nav = (page: Page, name: string) =>
  page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
async function quick(page: Page) {
  await page.getByRole('button', { name: '빠른 추가', exact: true }).click()
  return page.getByRole('dialog', { name: '빠른 추가', exact: true })
}

test('Home reveals booking numbers and route, and completes or undoes a visit without entering a trip', async ({
  page,
}) => {
  const outside = await boot(page)
  const before = (await stored(page))[0]
  await expect(page.locator('.home-booking-card')).toContainText('EXAMPLE123')
  await expect(page.locator('.home-flight-route')).toContainText('ICN')
  await expect(page.locator('.home-flight-route')).toContainText('GUM')
  await page
    .getByRole('button', { name: '해변 산책 방문 완료', exact: true })
    .click()
  expect((await stored(page))[0].days[0][0]).toEqual({
    ...before.days[0][0],
    status: 'done',
  })
  await page
    .getByRole('button', { name: '해변 산책 완료 취소', exact: true })
    .click()
  expect((await stored(page))[0].days[0][0]).toEqual({
    ...before.days[0][0],
    status: 'planned',
  })
  await page
    .getByRole('checkbox', { name: '여권 유효기간 확인 준비 완료' })
    .click()
  const after = (await stored(page))[0]
  expect(after.checklist?.[0].done).toBe(true)
  expect(after.reservations).toEqual(before.reservations)
  expect(after.expenses).toEqual(before.expenses)
  expect(after.days[0][0].time).toBe('')
  expect(outside).toEqual([])
})
test('Home trip choice changes the quick-add target and survives restart without rewriting trips', async ({
  page,
}) => {
  const a = trip(),
    b = trip('second')
  b.startDate = '2027-01-12'
  b.endDate = '2027-01-14'
  await boot(page, [a, b])
  const before = await stored(page)
  await page.getByLabel('홈에서 볼 여행').selectOption('second')
  let d = await quick(page)
  await expect(d).toContainText(b.title)
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('홈에서 볼 여행')).toHaveValue('second')
  d = await quick(page)
  await expect(d).toContainText(b.title)
  expect(await stored(page)).toEqual(before)
})
test('Home automatically follows a newly created nearer trip when no trip was explicitly chosen', async ({
  page,
}) => {
  await boot(page)
  await page
    .getByRole('button', { name: '새 여행 만들기', exact: true })
    .click()
  const d = page.getByRole('dialog')
  await d.getByLabel('여행 도시', { exact: true }).fill('도쿄')
  await d.getByLabel('출발일', { exact: true }).fill('2026-11-20')
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await nav(page, '홈')
  await expect(page.locator('.planner-home h1')).toHaveText('도쿄 여행')
  await expect(page.getByLabel('홈에서 볼 여행')).toHaveValue(
    (await stored(page)).find((item) => item.title === '도쿄 여행')!.id,
  )
})
test('paste several plans, review exclusions, choose a day and save once with blank times and no invented location', async ({
  page,
}) => {
  const outside = await boot(page)
  const before = (await stored(page))[0]
  const d = await quick(page)
  await d
    .getByLabel('일정 여러 개 붙여넣기')
    .fill(
      '해변 산책\n카페: 쉬어 갈 카페 | 창가 확인\n09:30 맛집: 점심 후보\n25:00 잘못된 시간',
    )
  await expect(
    d.getByRole('button', { name: '2개 일정 한 번에 추가' }),
  ).toBeEnabled()
  await expect(d).toContainText('이미 있는 이름')
  await expect(d).toContainText('방문 시간을 확인')
  await d.getByLabel('빠른 추가 날짜').selectOption('1')
  await expect(
    d.getByRole('button', { name: '3개 일정 한 번에 추가' }),
  ).toBeEnabled()
  await d.getByRole('button', { name: '3개 일정 한 번에 추가' }).click()
  await expect(d).toBeHidden()
  const after = (await stored(page))[0]
  expect(after.days[0]).toEqual(before.days[0])
  expect(after.days[2]).toEqual(before.days[2])
  expect(after.days[1].map((s) => s.time)).toEqual(['', '', '09:30'])
  expect(after.days[1].map((s) => s.custom?.destinationId)).toEqual([
    'own-tokyo',
    'own-tokyo',
    'own-tokyo',
  ])
  expect(after.days[1][1].note).toBe('창가 확인')
  expect(
    after.days[1].every(
      (s) =>
        !s.custom?.coordinates &&
        !s.custom?.googlePlaceId &&
        !s.reservationId &&
        !s.photoId,
    ),
  ).toBe(true)
  expect(new Set(after.days[1].map((s) => s.id)).size).toBe(3)
  expect(after.reservations).toEqual(before.reservations)
  expect(outside).toEqual([])
})
test('bulk save failure preserves the paste draft across restart, and a retry adds each plan once', async ({
  page,
}) => {
  await boot(page)
  const before = (await stored(page))[0]
  let d = await quick(page)
  await d.getByLabel('일정 여러 개 붙여넣기').fill('첫 후보\n두 번째 후보')
  await page.evaluate(() => {
    ;(window as any).failModernSave = true
  })
  await d.getByRole('button', { name: '2개 일정 한 번에 추가' }).click()
  await expect(d).toBeVisible()
  expect((await stored(page))[0]).toEqual(before)
  await expect(d.getByLabel('일정 여러 개 붙여넣기')).toHaveValue(
    '첫 후보\n두 번째 후보',
  )
  await page.reload()
  d = page.getByRole('dialog', { name: '빠른 추가', exact: true })
  await expect(d.getByLabel('일정 여러 개 붙여넣기')).toHaveValue(
    '첫 후보\n두 번째 후보',
  )
  await d.getByRole('button', { name: '2개 일정 한 번에 추가' }).click()
  expect((await stored(page))[0].days[0].map((s) => s.custom?.name)).toEqual([
    '해변 산책',
    '첫 후보',
    '두 번째 후보',
  ])
})
test('flight text fills a reviewable booking form; saving never schedules the reservation or invents a charge', async ({
  page,
}) => {
  const outside = await boot(page)
  const before = (await stored(page))[0]
  let d = await quick(page)
  await d.getByRole('button', { name: '항공 예약', exact: true }).click()
  d = page.getByRole('dialog', { name: '예약 빠르게 기록' })
  await d.getByText('예약 문자·메일 붙여넣기', { exact: true }).click()
  const text =
    '항공사: 예시 항공\n편명: JD456\n출발 공항: ICN\n도착 공항: GUM\n출발: 2026-12-22 20:00\n도착: 2026-12-23 02:00\n예약 번호: NEWEXAMPLE\n가격: 990000'
  await d.getByLabel('예약 내용 붙여넣기').fill(text)
  await d.getByRole('button', { name: '입력칸에 채우기' }).click()
  await expect(d.getByLabel('예약 이름', { exact: true })).toHaveValue(
    '예시 항공 · JD456',
  )
  expect((await stored(page))[0]).toEqual(before)
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  d = await quick(page)
  await d.getByRole('button', { name: '항공 예약', exact: true }).click()
  d = page.getByRole('dialog', { name: '예약 빠르게 기록' })
  await expect(d.getByLabel('예약 이름', { exact: true })).toHaveValue(
    '예시 항공 · JD456',
  )
  await d.getByText('예약 문자·메일 붙여넣기', { exact: true }).click()
  await expect(d.getByLabel('예약 내용 붙여넣기')).toHaveValue(text)
  await d.getByRole('button', { name: '예약 정보 저장', exact: true }).click()
  await expect(d).toBeHidden()
  const after = (await stored(page))[0],
    added = after.reservations?.find((r) => r.reference === 'NEWEXAMPLE')!
  expect(added.flight).toMatchObject({
    number: 'JD456',
    departureAirport: 'ICN',
    arrivalAirport: 'GUM',
    arrivalDate: '2026-12-23',
    arrivalTime: '02:00',
  })
  expect(added.flight?.departureTimeZone).toBeUndefined()
  expect(added.cost).toBeUndefined()
  expect(after.days).toEqual(before.days)
  expect(after.expenses).toEqual(before.expenses)
  expect(outside).toEqual([])
})
test('attach a document through Quick Add and open it directly on Home, without listing trip photos as documents', async ({
  page,
}) => {
  await boot(page)
  let d = await quick(page)
  await d.getByRole('button', { name: '자료 첨부', exact: true }).click()
  d = page.getByRole('dialog', { name: '여행 자료', exact: true })
  const text = '내 예시 여행 확인서 — PRIVATE FIXTURE'
  await d.getByLabel('첨부할 자료 파일').setInputFiles({
    name: '확인서.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  })
  await expect(d.locator('[data-attachment-id]')).toHaveCount(1)
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .locator('.home-documents')
    .getByRole('button', { name: '확인서.txt 자료 열기', exact: true })
    .click()
  const preview = page.locator('dialog.attachment-preview')
  await expect(preview.locator('pre')).toHaveText(text)
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  expect((await stored(page))[0].attachments?.[0].purpose).toBe('document')
})
test('quick expense opens in the selected trip without requiring the finance menu', async ({
  page,
}) => {
  await boot(page)
  const d = await quick(page)
  await d.getByRole('button', { name: '지출 기록', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('금액')
  expect((await stored(page))[0].expenses).toEqual([])
})
test('modern pages and bottom sheets fit narrow phones, retain 44px primary touches and clear the fixed navigation', async ({
  page,
}, info) => {
  await boot(page)
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 851 })
    await nav(page, '홈')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true)
    const fab = page.getByRole('button', { name: '빠른 추가', exact: true })
    const box = (await fab.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.width).toBeGreaterThanOrEqual(44)
    if (await page.locator('.bottom-nav').isVisible())
      expect(box.y + box.height).toBeLessThan(
        (await page.locator('.bottom-nav').boundingBox())!.y,
      )
    if (width === 393)
      await page.screenshot({
        path: info.outputPath('home-393.png'),
        animations: 'disabled',
      })
    const d = await quick(page)
    await d
      .getByLabel('일정 여러 개 붙여넣기')
      .fill('아주긴장소이름'.repeat(10) + '\n카페: 창가 자리')
    expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true,
    )
    if (width === 393)
      await page.screenshot({
        path: info.outputPath('quick-393.png'),
        animations: 'disabled',
      })
    await page.keyboard.press('Escape')
    await expect(d).toBeHidden()
  }
})
test('local parsers preserve explicit times and notes and reject invalid dates without guessing coordinates, prices or time zones', () => {
  const lines = parsePlanText(
    '1. 해변 산책\n08:15 카페: 아침 카페 | 창가\n25:00 잘못된 시간\n[내 장소](https://maps.google.com/?q=test)',
    ['해변 산책'],
  )
  expect(lines[0].duplicate).toBe(true)
  expect(lines[1]).toMatchObject({ time: '08:15', kind: '카페', note: '창가' })
  expect(lines[2].error).toBeTruthy()
  const original = trip(),
    before = JSON.stringify(original)
  const updated = appendPlanLines(original, 1, [lines[1]])
  expect(updated.days[0]).toBe(original.days[0])
  expect(updated.days[1][0].custom?.coordinates).toBeUndefined()
  expect(JSON.stringify(original)).toBe(before)
  expect(() => appendPlanLines(original, 1, [lines[2]])).toThrow()
  expect(
    parseBookingText(
      '호텔명: 예시 호텔\n체크인: 2026-12-22 15:00\n체크아웃: 2026-12-26 11:00\n예약번호: EXAMPLE',
      '숙소',
    ),
  ).toMatchObject({
    title: '예시 호텔',
    date: '2026-12-22',
    endDate: '2026-12-26',
    time: '15:00',
    reference: 'EXAMPLE',
    stay: { checkoutTime: '11:00' },
  })
  expect(
    parseBookingText(
      '출발: 2026-13-40 25:90\n가격: 300000\n항공편이 자동 변경되었습니다',
      '항공',
    ),
  ).toEqual({})
  expect(parseBookingText('체크인: 2026-02-31', '숙소')).toEqual({})
  const badLink = parsePlanText('[내 장소](https://#)')
  expect(badLink[0].error).toContain('링크')
  expect(() => appendPlanLines(original, 1, badLink)).toThrow()
})
