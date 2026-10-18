import { openTrips, openWorkspace } from './navigation'
import { test, expect, type Page } from '@playwright/test'
async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto('/')
  await page.evaluate((extra) => {
    const custom = (name: string) => ({
      name,
      kind: '관광',
      address: 'Paris, France',
      link: '',
      destinationId: 'paris',
    })
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'upgrade-trip',
            title: '파리 자유여행',
            cityId: 'custom-paris',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            travelers: 2,
            days: [
              [
                {
                  id: 'tower-stop',
                  placeId: 'custom-tower',
                  time: '10:00',
                  note: '예약표 챙기기',
                  custom: custom('에펠탑'),
                  durationMinutes: 60,
                },
                {
                  id: 'cafe-stop',
                  placeId: 'custom-cafe',
                  time: '10:30',
                  note: '',
                  custom: custom('파리 카페'),
                  durationMinutes: 30,
                },
              ],
              [],
              [],
            ],
            destinations: [{ id: 'paris', name: '파리', country: '프랑스' }],
            dayDestinationIds: ['paris', 'paris', 'paris'],
            ...extra,
          },
        ],
      }),
    )
  }, extra)
  await page.reload()
  await openTrips(page)
}
async function tab(page: Page, name: string) {
  await openWorkspace(page, name)
}
async function members(page: Page) {
  await tab(page, '여행 준비')
  await page.getByRole('button', { name: '동행인 등록', exact: true }).click()
  await page.getByLabel('동행인 이름 1').fill('민수')
  await page.getByLabel('동행인 이름 2').fill('지수')
  await page.getByRole('button', { name: '동행인 저장' }).click()
}
async function expense(
  page: Page,
  title: string,
  amount: string,
  direction = 'expense',
) {
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await page.getByLabel('지출 이름', { exact: true }).fill(title)
  await page.getByLabel('지출 통화', { exact: true }).selectOption('EUR')
  await page.getByLabel('금액', { exact: true }).fill(amount)
  await page.getByLabel('기록 유형').selectOption(direction)
  await page
    .getByRole('combobox', {
      name: direction === 'expense' ? '결제한 사람' : '환불 받은 사람',
      exact: true,
    })
    .selectOption({ label: '민수' })
  await page.getByLabel('비용 분담').selectOption('even')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
}

test('준비 목록 템플릿·담당자·기한과 대시보드가 연결되고 재시작 유지', async ({
  page,
}) => {
  await seed(page)
  await members(page)
  await tab(page, '준비물')
  await page.getByLabel('준비 목록 유형').selectOption('가족 여행')
  await page.getByRole('button', { name: '가족 여행 준비 목록 넣기' }).click()
  await page.getByRole('button', { name: '가족 여행 준비 목록 넣기' }).click()
  await expect(page.locator('.checklist input[type="checkbox"]')).toHaveCount(
    12,
  )
  await page
    .getByRole('button', { name: '여권 유효기간 확인 준비물 수정' })
    .click()
  await page.getByLabel('준비물 기한').fill('2000-01-01')
  await page.getByLabel('준비물 담당자').selectOption({ label: '민수' })
  await page.getByLabel('준비물 메모').fill('여권 사본도 준비')
  await page.getByRole('button', { name: '준비물 수정 저장' }).click()
  await tab(page, '여행 준비')
  await expect(page.getByRole('region', { name: '여행 점검' })).toContainText(
    '여권 유효기간 확인 · 기한 지남',
  )
  await tab(page, '준비물')
  await page.getByLabel('준비 상태 필터').selectOption('기한 지남')
  await expect(page.locator('.checklist input[type="checkbox"]')).toHaveCount(1)
  await page.getByLabel('여권 유효기간 확인', { exact: true }).click()
  await expect(page.locator('.checklist input[type="checkbox"]')).toHaveCount(0)
  await page.reload()
  await openTrips(page)
  await tab(page, '준비물')
  await expect(
    page.getByLabel('여권 유효기간 확인', { exact: true }),
  ).toBeChecked()
  await expect(
    page
      .locator('.checklist-row')
      .filter({ has: page.getByLabel('여권 유효기간 확인', { exact: true }) }),
  ).toContainText('민수')
})

test('여행 실행에서 방문 완료·체류 시간·지출 기록을 연결하고 편집 후 상태 보존', async ({
  page,
}) => {
  await seed(page)
  await expect(
    page.getByText('시간이 겹치는 일정 1건', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: '에펠탑 방문 완료', exact: true })
    .click()
  await expect(page.locator('.day-progress')).toContainText('1/2 방문 완료')
  await expect(page.locator('.time-conflicts')).toHaveCount(0)
  await page
    .locator('.stop-place')
    .getByRole('button')
    .filter({ hasText: '에펠탑' })
    .click()
  await page.getByLabel('장소 또는 일정 이름').fill('에펠탑 전망대')
  await page.getByRole('button', { name: '직접 추가한 일정 수정' }).click()
  await expect(
    page.getByRole('button', { name: '에펠탑 전망대 완료 취소', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '에펠탑 전망대 지출 기록' }).click()
  await expect(page.getByLabel('지출 이름')).toHaveValue('에펠탑 전망대')
  await expect(page.getByLabel('지출 날짜', { exact: true })).toHaveValue(
    '2026-11-01',
  )
  await page.getByLabel('지출 통화', { exact: true }).selectOption('KRW')
  await page.getByLabel('금액', { exact: true }).fill('12000')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await page.reload()
  await openTrips(page)
  await tab(page, '가계부')
  await expect(page.locator('.expense-list')).toContainText('₩12,000')
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(state.days[0][0]).toMatchObject({
    status: 'done',
    durationMinutes: 60,
  })
  expect(state.expenses[0].stopId).toBe('tower-stop')
})

test('예약 비용 중복 방지·확정 상태·예약 수정의 일정 반영과 취소 후 경비 유지', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '예약')
  await page
    .getByRole('button', { name: '예약 정보 추가', exact: true })
    .click()
  await page.getByLabel('예약 이름', { exact: true }).fill('파리 숙소')
  await page.getByLabel('예약 번호', { exact: true }).fill('PARIS-42')
  await page
    .getByRole('combobox', { name: '예약 상태', exact: true })
    .selectOption('confirmed')
  await page.getByText('비용·결제일', { exact: true }).click()
  await page.getByLabel('예약 비용 통화').selectOption('EUR')
  await page.getByLabel('예약 비용', { exact: true }).fill('120')
  await page.getByLabel('체크아웃 날짜').fill('2026-11-03')
  await page.getByRole('button', { name: '예약 정보 저장' }).click()
  await page.getByRole('button', { name: '파리 숙소 일정에 복사' }).click()
  await page.getByRole('button', { name: '파리 숙소 지출로 기록' }).click()
  await expect(
    page.getByRole('button', { name: '파리 숙소 지출로 기록' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '파리 숙소 예약 수정' }).click()
  await page.getByLabel('이용 날짜').fill('2026-11-02')
  await page.getByLabel('이용 시간').fill('16:00')
  await page.getByLabel('예약 메모').fill('늦은 체크인 안내')
  await page.getByRole('button', { name: '예약 정보 저장' }).click()
  await tab(page, '일정')
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(page.locator('.timeline-item')).toContainText('파리 숙소')
  await expect(page.getByLabel('파리 숙소 방문 시간')).toHaveValue('16:00')
  await expect(page.getByLabel('파리 숙소 메모')).toHaveValue(
    '예약 번호: PARIS-42\n늦은 체크인 안내',
  )
  await tab(page, '예약')
  await page.getByLabel('파리 숙소 예약 상태').selectOption('cancelled')
  await tab(page, '일정')
  await expect(
    page.getByRole('button', { name: '파리 숙소 방문 완료', exact: true }),
  ).toBeDisabled()
  await page.reload()
  await openTrips(page)
  await tab(page, '가계부')
  await expect(page.locator('.expense-totals')).toContainText('€120.00')
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(stored.expenses).toHaveLength(1)
  expect(stored.reservations[0].status).toBe('cancelled')
})

test('환율·예산·환불·동행인 정산·CSV를 같은 가계부에서 사용', async ({
  page,
}) => {
  await seed(page)
  await members(page)
  await tab(page, '가계부')
  await expense(page, '저녁 식사', '30')
  await expense(page, '식사 환불', '10', 'refund')
  await expect(page.locator('.money-overview')).toContainText('환율 입력 필요')
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name: '예산', exact: true })
    .click()
  await page.getByLabel('전체 여행 예산').fill('25000')
  await page.getByLabel('환율 통화').selectOption('EUR')
  await page.getByLabel('환율 값').fill('1500')
  await page.getByRole('button', { name: '환율·전체 예산 저장' }).click()
  await expect(page.locator('.money-overview')).toContainText('₩30,000')
  await expect(page.locator('.money-overview')).toContainText('초과 ₩5,000')
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name: '정산', exact: true })
    .click()
  await expect(page.locator('.settlement-transfer')).toContainText(
    '지수 → 민수',
  )
  await expect(page.locator('.settlement-transfer')).toContainText('€10.00')
  await page.getByRole('button', { name: '동행인 편집' }).click()
  await expect(
    page.getByRole('button', { name: '민수 동행인 삭제' }),
  ).toBeDisabled()
  await page.getByLabel('동행인 이름 1').fill('민수님')
  await page.getByRole('button', { name: '동행인 저장' }).click()
  await expect(page.locator('.settlement-transfer')).toContainText(
    '지수 → 민수님',
  )
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name: '통계', exact: true })
    .click()
  await expect(page.locator('.stat-list').first()).toContainText('€20.00')
  await page.getByRole('button', { name: 'CSV 복사', exact: true }).click()
  await expect(page.getByLabel('경비 CSV')).toHaveValue(/저녁 식사/)
  await page.reload()
  await openTrips(page)
  await tab(page, '가계부')
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name: '정산', exact: true })
    .click()
  await expect(page.locator('.settlement-transfer')).toContainText('€10.00')
})

test('개별 분담 합계 오류는 저장하지 않고 새 정보도 백업·복원', async ({
  page,
}) => {
  const extra = {
    members: [
      { id: 'a', name: '민수' },
      { id: 'b', name: '지수' },
    ],
    baseCurrency: 'KRW',
    totalBudget: 300000,
    exchangeRates: { EUR: 1500 },
    travelInfo: {
      emergencyPhone: '+33123456789',
      insurancePhone: '',
      embassyContact: '파리 연락처',
      lodgingAddress: 'Paris',
      note: '오프라인 연락 메모',
    },
  }
  await seed(page, extra)
  await tab(page, '가계부')
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await page.getByLabel('지출 이름').fill('공동 식사')
  await page.getByLabel('지출 통화', { exact: true }).selectOption('KRW')
  await page.getByLabel('금액', { exact: true }).fill('10000')
  await page.getByLabel('비용 분담').selectOption('custom')
  await page.getByLabel('민수 부담 금액').fill('2000')
  await page.getByLabel('지수 부담 금액').fill('7000')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('부담 금액 합계')
  await expect(page.locator('.expense-list > article')).toHaveCount(0)
  await page.getByLabel('지수 부담 금액').fill('8000')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await page.getByRole('button', { name: '여행 백업·공유' }).click()
  await page.locator('.legacy-backup > summary').click()
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  const backup = await page.getByLabel('내보낸 여행 내용').inputValue()
  expect(JSON.parse(backup).trips[0]).toMatchObject({
    totalBudget: 300000,
    exchangeRates: { EUR: 1500 },
    travelInfo: { note: '오프라인 연락 메모' },
    members: [{ id: 'a' }, { id: 'b' }],
    expenses: [
      {
        splits: [
          { memberId: 'a', amount: 2000 },
          { memberId: 'b', amount: 8000 },
        ],
      },
    ],
  })
  await page.getByLabel('백업 내용 붙여넣기').fill(backup)
  await page.getByRole('button', { name: '백업 내용 확인' }).click()
  await page.getByRole('button', { name: '여행 복사본 가져오기' }).click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await tab(page, '가계부')
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name: '정산', exact: true })
    .click()
  await expect(page.locator('.settlement-transfer')).toContainText('₩8,000')
})

test('320px에서 준비·예약·환율·분담 입력에 가로 넘침 없음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 840 })
  await seed(page)
  await members(page)
  async function fits() {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
  }
  await fits()
  await tab(page, '준비물')
  await page.getByRole('button', { name: '기본 여행 준비 목록 넣기' }).click()
  await fits()
  await tab(page, '예약')
  await page
    .getByRole('button', { name: '예약 정보 추가', exact: true })
    .click()
  await page.getByText('비용·결제일', { exact: true }).click()
  await fits()
  await tab(page, '가계부')
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await page.getByLabel('비용 분담').selectOption('custom')
  await fits()
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name: '예산', exact: true })
    .click()
  await fits()
  await page.screenshot({
    path: `artifacts/upgraded-cost-${test.info().project.name}.png`,
    fullPage: true,
  })
  await tab(page, '여행 준비')
  await page.screenshot({
    path: `artifacts/upgraded-ready-${test.info().project.name}.png`,
    fullPage: true,
  })
})
