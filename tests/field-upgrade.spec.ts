import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import { openTrips, openWorkspace } from './navigation'
function trip(): Trip {
  return tripSchema.parse({
    id: 'six-point',
    title: '나와 동행자의 교토·방콕',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    travelers: 2,
    members: [
      { id: 'me', name: '나' },
      { id: 'friend', name: '동행' },
    ],
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
      { id: 'bangkok', name: '방콕', country: '태국', guideCityId: 'bangkok' },
    ],
    dayDestinationIds: ['kyoto', 'kyoto', 'bangkok'],
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '비가 오면 관람을 줄이기',
          reservationId: 'ticket',
        },
      ],
      [{ id: 'fushimi', placeId: 'fushimi', time: '14:00', note: '물 준비' }],
      [],
    ],
    reservations: [
      {
        id: 'ticket',
        title: '입장 예약',
        kind: '체험',
        date: '2026-11-01',
        time: '10:00',
        reference: 'PRIVATE-123',
        address: '교토',
        link: '',
        note: '예약 메모',
        status: 'confirmed',
      },
    ],
    checklist: [{ id: 'passport', title: '여권 확인', done: false }],
    attachments: [
      {
        id: 'aaaa1111-1111-4111-8111-111111111111',
        name: '예약.pdf',
        mimeType: 'application/pdf',
        size: 4,
        createdAt: '2026-10-16T00:00:00.000Z',
        storage: 'browser',
        reservationId: 'ticket',
      },
    ],
  })
}
async function seed(page: Page) {
  await page.clock.install({ time: new Date('2026-11-01T12:00:00') })
  await page.route('https://**', (route) => route.abort())
  await page.goto('/')
  await page.evaluate(async (trip) => {
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
        new Blob(['%PDF'], { type: 'application/pdf' }),
        'aaaa1111-1111-4111-8111-111111111111',
      )
      tx.oncomplete = () => resolve()
    })
    db.close()
  }, trip())
  await page.reload()
  await openTrips(page)
}
async function tab(page: Page, name: string) {
  await openWorkspace(page, name)
}
async function field(page: Page) {
  await tab(page, '여행 중')
  await page.evaluate(() => scrollTo(0, 0))
  await page.evaluate(() => document.fonts.ready)
}
async function record(page: Page) {
  await page
    .locator('.field-actions')
    .getByRole('button', { name: '지출 기록', exact: true })
    .click()
}
async function state(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}

test('393×852 현장 첫 화면에 다음 장소와 세 동작, 지연 표시·관리 메뉴·사진 접기와 건너뛰기 복귀', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await seed(page)
  await field(page)
  await expect(page.locator('.field-delay')).toContainText('2시간')
  const nav = await page.locator('.bottom-nav').boundingBox()
  for (const action of await page.locator('.field-actions > *').all()) {
    const rect = await action.boundingBox()
    expect(rect!.y).toBeGreaterThan(0)
    expect(rect!.y + rect!.height).toBeLessThan(nav!.y - 8)
    expect(rect!.height).toBeGreaterThanOrEqual(44)
  }
  await expect(page.locator('.field-place-info')).not.toHaveAttribute(
    'open',
    '',
  )
  await expect(
    page.getByRole('button', { name: '여행 삭제', exact: true }),
  ).toBeHidden()
  await page.locator('.field-management summary').click()
  await expect(
    page.getByRole('button', { name: '여행 정보 수정', exact: true }),
  ).toBeVisible()
  await page.locator('.field-management summary').click()
  await page.screenshot({ path: info.outputPath('field-first-screen.png') })
  await page
    .getByRole('button', { name: '이번 장소 건너뛰기', exact: true })
    .click()
  await expect(page.locator('.field-next')).toContainText('남은 방문이 없어요')
  await page.getByRole('button', { name: '실행 취소', exact: true }).click()
  await expect(page.locator('.field-next h2')).toHaveText('기요미즈데라')
  await page.clock.runFor(60000)
  await expect(page.locator('.field-delay')).toContainText('2시간 1분')
  await page.getByLabel('현장에서 볼 날짜').selectOption('1')
  await expect(page.locator('.field-delay')).toHaveCount(0)
})

test('일정 지출은 금액만으로 JPY 저장·현장 복귀·원래 예약·메모·PDF·준비물 보존', async ({
  page,
}) => {
  await seed(page)
  await field(page)
  const before = await state(page)
  await record(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('지출 통화', { exact: true })).toHaveValue(
    'JPY',
  )
  await expect(dialog.getByLabel('지출 이름', { exact: true })).toBeHidden()
  await expect(dialog.locator('input:visible')).toHaveCount(1)
  await dialog.getByLabel('금액', { exact: true }).fill('1500')
  await dialog.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: '여행 중', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  const after = await state(page)
  expect(after.expenses).toHaveLength(1)
  expect(after.expenses[0]).toMatchObject({
    title: '기요미즈데라',
    amount: 1500,
    currency: 'JPY',
    date: '2026-11-01',
    payerId: 'me',
    category: '관광',
    stopId: 'temple',
    reservationId: 'ticket',
  })
  for (const key of [
    'days',
    'reservations',
    'attachments',
    'checklist',
    'members',
  ])
    expect(after[key]).toEqual(before[key])
  expect(
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('jido-attachments-v1', 1)
        r.onsuccess = () => resolve(r.result)
      })
      const blob = await new Promise<Blob>((resolve) => {
        const r = db
          .transaction('files')
          .objectStore('files')
          .get('aaaa1111-1111-4111-8111-111111111111')
        r.onsuccess = () => resolve(r.result)
      })
      db.close()
      return blob.text()
    }),
  ).toBe('%PDF')
  await record(page)
  await expect(page.getByLabel('금액', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: '닫기', exact: true }).first().click()
  await page.reload()
  await openTrips(page)
  await tab(page, '가계부')
  await expect(page.locator('.expense-list')).toContainText('기요미즈데라')
})

test('상세 분담·메모·통화 선택 보존, 도시별 통화·결제자 기억 및 다른 날 날짜 자동 적용', async ({
  page,
}) => {
  await seed(page)
  await field(page)
  await record(page)
  await page.getByLabel('지출 통화', { exact: true }).selectOption('USD')
  await page.getByLabel('결제한 사람', { exact: true }).selectOption('friend')
  await page.getByLabel('금액', { exact: true }).fill('15')
  await page.getByText('상세 입력', { exact: true }).click()
  await page.getByLabel('비용 분담', { exact: true }).selectOption('even')
  await page.getByLabel('경비 메모', { exact: true }).fill('함께 낸 입장료')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  expect((await state(page)).expenses[0]).toMatchObject({
    currency: 'USD',
    payerId: 'friend',
    note: '함께 낸 입장료',
    splits: [
      { memberId: 'me', amount: 7.5 },
      { memberId: 'friend', amount: 7.5 },
    ],
  })
  await record(page)
  await expect(page.getByLabel('지출 통화', { exact: true })).toHaveValue('USD')
  await expect(page.getByLabel('결제한 사람', { exact: true })).toHaveValue(
    'friend',
  )
  await page.getByRole('button', { name: '닫기', exact: true }).first().click()
  await page.getByLabel('현장에서 볼 날짜').selectOption('1')
  await record(page)
  await expect(page.getByLabel('지출 날짜', { exact: true })).toHaveValue(
    '2026-11-02',
  )
  await expect(page.getByLabel('지출 통화', { exact: true })).toHaveValue('USD')
  await page.getByRole('button', { name: '닫기', exact: true }).first().click()
  await page.getByLabel('현장에서 볼 날짜').selectOption('2')
  await page
    .locator('.field-shortcuts')
    .getByRole('button', { name: '지출 추가', exact: true })
    .click()
  await expect(page.getByLabel('지출 통화', { exact: true })).toHaveValue('THB')
  await expect(page.getByLabel('지출 날짜', { exact: true })).toHaveValue(
    '2026-11-03',
  )
})

test('빠른 지출 초안은 닫기·재시작 후 복구, 저장 실패는 창과 입력·기존 기록 유지', async ({
  page,
}) => {
  await seed(page)
  await field(page)
  await record(page)
  await page.getByLabel('금액', { exact: true }).fill('980')
  await page.getByRole('button', { name: '닫기', exact: true }).first().click()
  await page.reload()
  await openTrips(page)
  await field(page)
  await record(page)
  await expect(page.getByLabel('금액', { exact: true })).toHaveValue('980')
  const before = await state(page)
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-travel-v1')
        throw new DOMException('full', 'QuotaExceededError')
      return set.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('저장 공간')
  await expect(page.getByLabel('금액', { exact: true })).toHaveValue('980')
  expect(await state(page)).toEqual(before)
})

test('320px·큰 글자·짧은 키보드 화면에서도 빠른 입력·저장과 긴 현장 정보가 잘리지 않음', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await field(page)
  await page.addStyleTag({
    content:
      '.field-next h2 {font-size:28px} .field-actions .button {font-size:18px}',
  })
  for (const button of await page.locator('.field-actions > *').all())
    expect(
      await button.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
  await record(page)
  await page.getByLabel('금액', { exact: true }).fill('1000')
  await page.setViewportSize({ width: 320, height: 420 })
  await page.getByLabel('금액', { exact: true }).focus()
  await page
    .getByRole('button', { name: '지출 저장', exact: true })
    .scrollIntoViewIfNeeded()
  const save = await page
    .getByRole('button', { name: '지출 저장', exact: true })
    .boundingBox()
  expect(save!.y + save!.height).toBeLessThanOrEqual(420)
  await page.screenshot({ path: info.outputPath('quick-expense-short.png') })
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  expect((await state(page)).expenses).toHaveLength(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('손대지 않은 입력창은 이전 기본값을 초안으로 고정하지 않고 최신 통화를 사용하며 잘못된 분담은 저장하지 않음', async ({
  page,
}) => {
  await seed(page)
  await field(page)
  await record(page)
  await page.getByRole('button', { name: '닫기', exact: true }).first().click()
  await page
    .locator('.field-shortcuts')
    .getByRole('button', { name: '지출 추가', exact: true })
    .click()
  await page.getByLabel('지출 통화', { exact: true }).selectOption('USD')
  await page.getByLabel('금액', { exact: true }).fill('20')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await record(page)
  await expect(page.getByLabel('지출 통화', { exact: true })).toHaveValue('USD')
  await page.getByLabel('금액', { exact: true }).fill('20')
  await page.getByText('상세 입력', { exact: true }).click()
  await page.getByLabel('비용 분담', { exact: true }).selectOption('custom')
  await page.getByLabel('나 부담 금액', { exact: true }).fill('8')
  await page.getByLabel('동행 부담 금액', { exact: true }).fill('8')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('분담 합계')
  expect((await state(page)).expenses).toHaveLength(1)
  await page.getByLabel('동행 부담 금액', { exact: true }).fill('12')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  expect((await state(page)).expenses[1].splits).toEqual([
    { memberId: 'me', amount: 8 },
    { memberId: 'friend', amount: 12 },
  ])
})
