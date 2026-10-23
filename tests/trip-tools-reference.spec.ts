import { test, expect, type Page } from '@playwright/test'
import { openTrips } from './navigation'
import { tripSchema } from '../src/travel-model'
const trip = tripSchema.parse({
  id: 'reference-tools',
  title: '삿포로에서 여유롭게 함께하는 긴 이름의 여행',
  cityId: 'sapporo',
  startDate: '2026-12-01',
  endDate: '2026-12-02',
  travelers: 2,
  members: [
    { id: 'me', name: '나' },
    { id: 'friend', name: '동행' },
  ],
  days: [[], []],
  checklist: [
    {
      id: 'passport',
      title: '여권과 여권 사본 챙기기',
      category: '서류',
      done: false,
      note: '유효기간도 확인',
      assigneeId: 'me',
    },
    { id: 'ticket', title: '항공권 확인', category: '예약', done: true },
    {
      id: 'medicine',
      title: '동행자와 나의 상비약 챙기기',
      category: '짐',
      done: false,
    },
  ],
  expenses: [
    {
      id: 'hotel',
      title: '여행 전에 결제한 숙소 예약금',
      date: '2026-11-01',
      amount: 10000,
      currency: 'KRW',
      category: '숙박',
      payer: '나',
    },
    {
      id: 'meal',
      title: '첫날 긴 이름을 가진 식당의 저녁 식사',
      date: '2026-12-01',
      amount: 2000,
      currency: 'JPY',
      category: '식비',
      payer: '동행',
      payerId: 'friend',
      note: '메모 보존',
    },
    {
      id: 'refund',
      title: '식사 부분 환불',
      date: '2026-12-01',
      amount: 200,
      currency: 'JPY',
      category: '식비',
      payer: '동행',
      direction: 'refund',
    },
    {
      id: 'taxi',
      title: '숙소까지 택시',
      date: '2026-12-01',
      amount: 5000,
      currency: 'KRW',
      category: '교통',
      payer: '나',
    },
  ],
  settlementPayments: [
    {
      id: 'transfer',
      date: '2026-12-01',
      from: 'friend',
      to: 'me',
      currency: 'KRW',
      amount: 70000,
      note: '정산만',
    },
  ],
})

async function seed(page: Page) {
  await page.goto('/')
  await page.evaluate((trip) => {
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
      'jido-view-reference-tools',
      JSON.stringify({ day: 1, workspace: 'schedule' }),
    )
  }, trip)
  await page.reload()
  await openTrips(page)
}
test('여행 바로가기는 어느 작업에서도 같은 날짜와 기록을 유지', async ({
  page,
}) => {
  await seed(page)
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  const links = page.getByRole('navigation', { name: '여행 도구 바로가기' })
  for (const [name, target] of [
    ['준비물', '.preparation-checklist'],
    ['가계부', '.expense-manager'],
    ['항공·숙소 예약', '.workspace-reservations'],
  ] as const) {
    await links.getByRole('button', { name, exact: true }).click()
    await expect(page.locator(target)).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('jido-view-reference-tools')!).day,
      ),
    ).toBe(1)
  }
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})
test('분류 접기와 남은 준비물 보기로 원본을 바꾸지 않고 완료만 저장', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('navigation', { name: '여행 도구 바로가기' })
    .getByRole('button', { name: '준비물', exact: true })
    .click()
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  await expect(page.locator('.preparation-group')).toHaveCount(3)
  await page
    .locator('.preparation-group')
    .filter({ has: page.locator('summary strong', { hasText: '서류' }) })
    .locator('summary')
    .click()
  await expect(
    page.getByRole('checkbox', {
      name: '여권과 여권 사본 챙기기',
      exact: true,
    }),
  ).toHaveCount(0)
  await page
    .getByRole('group', { name: '준비물 빠른 보기' })
    .getByRole('button', { name: /남은 준비물/ })
    .click()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(before)
  await expect(
    page.getByRole('checkbox', { name: '항공권 확인', exact: true }),
  ).toHaveCount(0)
  const group = page
    .locator('.preparation-group')
    .filter({ has: page.locator('summary strong', { hasText: '서류' }) })
  await group.locator('summary').click()
  await page
    .getByRole('checkbox', { name: '여권과 여권 사본 챙기기', exact: true })
    .click()
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(after.checklist[0]).toEqual({ ...before.checklist[0], done: true })
  expect(after.expenses).toEqual(before.expenses)
  await expect(page.locator('.preparation-remaining')).toContainText('1개')
})
test('기간 합계는 준비 비용·날짜·환불·통화를 구분하고 정산 송금을 더하지 않음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page
    .getByRole('navigation', { name: '여행 도구 바로가기' })
    .getByRole('button', { name: '가계부', exact: true })
    .click()
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  const total = page.getByLabel('조회 지출 합계')
  await expect(total).toContainText('₩15,000')
  await expect(total).toContainText('JP¥1,800')
  await expect(total).not.toContainText('70,000')
  await page
    .getByLabel('가계부 기간', { exact: true })
    .selectOption('preparation')
  await expect(page.locator('.expense-list article')).toHaveCount(1)
  await expect(total).toContainText('₩10,000')
  await expect(total).not.toContainText('JP¥')
  await page
    .getByLabel('가계부 기간', { exact: true })
    .selectOption('2026-12-01')
  await expect(page.locator('.expense-list article')).toHaveCount(3)
  await expect(total).toContainText('₩5,000')
  await expect(total).toContainText('JP¥1,800')
  await total.scrollIntoViewIfNeeded()
  await expect(total).toBeInViewport()
  const totalBox = await total.boundingBox(),
    navBox = await page.locator('.bottom-nav:visible').boundingBox()
  expect(totalBox!.y + totalBox!.height).toBeLessThanOrEqual(navBox!.y)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await expect(page.getByLabel('가계부 기간', { exact: true })).toHaveValue('')
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})

test('평소에는 수정·삭제를 감추고 명시적 편집·삭제 취소가 기록을 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  const links = page.getByRole('navigation', { name: '여행 도구 바로가기' })
  await links.getByRole('button', { name: '준비물', exact: true }).click()
  const remove = page.getByRole('button', {
    name: '여권과 여권 사본 챙기기 준비물 삭제',
    exact: true,
  })
  await expect(remove).toHaveCount(0)
  await expect(
    page.getByRole('checkbox', {
      name: '여권과 여권 사본 챙기기',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: '준비물 편집', exact: true }).click()
  await expect(remove).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(before)
  await remove.click()
  await page.getByRole('button', { name: '실행 취소', exact: true }).click()
  await page.getByRole('button', { name: '준비물 편집', exact: true }).click()
  await expect(remove).toHaveCount(0)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(before)
  await links.getByRole('button', { name: '가계부', exact: true }).click()
  const deleteExpense = page.getByRole('button', {
    name: '숙소까지 택시 지출 삭제',
    exact: true,
  })
  await expect(deleteExpense).toHaveCount(0)
  await page.getByRole('button', { name: '지출 편집', exact: true }).click()
  await expect(deleteExpense).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(before)
  await deleteExpense.click()
  await expect(page.getByLabel('조회 지출 합계')).toHaveCount(0)
  await page.getByRole('button', { name: '실행 취소', exact: true }).click()
  await page.getByRole('button', { name: '지출 편집', exact: true }).click()
  await expect(deleteExpense).toHaveCount(0)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(before)
})
