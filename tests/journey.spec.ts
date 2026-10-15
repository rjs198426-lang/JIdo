import { expect, test, type Page } from '@playwright/test'

async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}
async function customTrip(page: Page) {
  await page.goto('/')
  await navigate(page, '내 여행')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const form = page.getByRole('dialog')
  await form.getByLabel('어디로 떠나세요?').selectOption('custom')
  await form.getByLabel('도시 이름', { exact: true }).fill('파리')
  await form.getByLabel('국가', { exact: true }).fill('프랑스')
  await form.getByLabel('여행 이름').fill('파리에서 로마까지')
  await form.getByLabel('출발일').fill('2026-11-01')
  await form.getByLabel('마지막 날').fill('2026-11-04')
  await form
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.trip-banner')).toContainText('파리에서 로마까지')
}
async function customStop(page: Page, name: string, kind = '관광') {
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('일정 유형').selectOption(kind)
  await form.getByLabel('장소 또는 일정 이름').fill(name)
  await form.getByText('주소·링크·메모', { exact: true }).click()
  await form.getByLabel('주소', { exact: true }).fill('5 Avenue Anatole France')
  await form.getByLabel('메모', { exact: true }).fill('예약 확인하고 출발')
  await form
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
}
async function tab(page: Page, name: string) {
  await page
    .getByRole('tablist', { name: '여행 관리', exact: true })
    .getByRole('tab', { name, exact: true })
    .click()
}

test('가이드 없이 파리·로마 여행, 직접 장소 편집, 도시별 일정과 동선 유지', async ({
  page,
}) => {
  await customTrip(page)
  await customStop(page, '에펠탑')
  await page.getByRole('button', { name: /에펠탑.*직접 추가한 일정/ }).click()
  await page
    .getByRole('dialog')
    .getByLabel('장소 또는 일정 이름')
    .fill('에펠탑 전망대')
  await page
    .getByRole('button', { name: '직접 추가한 일정 수정', exact: true })
    .click()
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await page.getByRole('button', { name: '도시 추가', exact: true }).click()
  await page.getByLabel('도시 이름', { exact: true }).fill('로마')
  await page.getByLabel('국가', { exact: true }).fill('이탈리아')
  await page
    .getByRole('button', { name: '경로에 도시 추가', exact: true })
    .click()
  await expect(page.getByLabel('이날의 체류 도시')).toContainText('로마')
  await customStop(page, '로마 숙소 체크인', '숙소')
  await customStop(page, '테르미니역 이동', '이동')
  await tab(page, '동선')
  await expect(page.locator('.route-stops li')).toHaveCount(2)
  await expect(
    page.getByRole('link', { name: /지도에서 길찾기/ }),
  ).toHaveAttribute('href', /maps\/dir\/\?.*origin=/)
  await expect(
    page.getByRole('link', { name: '로마 숙소 체크인 지도 검색' }),
  ).toHaveAttribute('href', /query=/)
  await page.reload()
  await navigate(page, '내 여행')
  await tab(page, '일정')
  await page.getByRole('tab', { name: /DAY 1/ }).click()
  await expect(page.getByLabel('에펠탑 전망대 메모')).toHaveValue(
    '예약 확인하고 출발',
  )
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(
    page.getByLabel('이날의 체류 도시').locator('option:checked'),
  ).toHaveText('로마 · 이탈리아')
  await expect(page.locator('.timeline-item')).toHaveCount(2)
  await page.locator('.city-details > summary').click()
  await expect(
    page.getByRole('button', { name: '로마 경로에서 삭제' }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: '로마 숙소 체크인 일정에서 삭제' })
    .click()
  await page.getByRole('button', { name: '실행 취소', exact: true }).click()
  await expect(page.locator('.timeline-item')).toHaveCount(2)
})

test('두 번째 도시의 가이드 장소를 같은 여행에 추가', async ({ page }) => {
  await customTrip(page)
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await page.getByRole('button', { name: '도시 추가', exact: true }).click()
  await page.getByLabel('추가할 여행지').selectOption('kyoto')
  await page
    .getByRole('button', { name: '경로에 도시 추가', exact: true })
    .click()
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '추천 장소에서 선택' }).click()
  await page
    .getByRole('button', { name: '니시키 시장 일정에 추가', exact: true })
    .click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.timeline-item')).toContainText('니시키 시장')
  await page.reload()
  await navigate(page, '내 여행')
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(
    page.getByLabel('이날의 체류 도시').locator('option:checked'),
  ).toHaveText('교토 · 일본')
  await expect(page.locator('.timeline-item')).toContainText('니시키 시장')
})

test('예약 정보·체크리스트 편집과 재시작 복원', async ({ page }) => {
  await customTrip(page)
  await tab(page, '예약')
  await page
    .getByRole('button', { name: '예약 정보 추가', exact: true })
    .click()
  await page.getByLabel('예약 이름', { exact: true }).fill('파리 숙소')
  await page.getByLabel('예약 번호', { exact: true }).fill('PARIS-TEST-42')
  await page.getByLabel('예약 확인 링크').fill('https://example.com/booking')
  await page.getByRole('button', { name: '예약 정보 저장' }).click()
  await expect(page.locator('.reservation-list')).toContainText('PARIS-TEST-42')
  await page.getByRole('button', { name: '파리 숙소 예약 수정' }).click()
  await page.getByLabel('예약 메모').fill('체크인 오후 4시')
  await page.getByRole('button', { name: '예약 정보 저장' }).click()
  await tab(page, '준비물')
  await page.getByRole('button', { name: /기본 여행 준비 목록 넣기/ }).click()
  await page.getByRole('button', { name: /기본 여행 준비 목록 넣기/ }).click()
  await expect(page.locator('.checklist input')).toHaveCount(8)
  await page.getByLabel('여권 유효기간 확인', { exact: true }).check()
  await page.getByLabel('새 준비물').fill('기차표 내려받기')
  await page
    .locator('.quick-add')
    .getByRole('button', { name: '추가', exact: true })
    .click()
  await page.reload()
  await navigate(page, '내 여행')
  await tab(page, '준비물')
  await expect(
    page.getByLabel('여권 유효기간 확인', { exact: true }),
  ).toBeChecked()
  await expect(
    page.getByLabel('기차표 내려받기', { exact: true }),
  ).not.toBeChecked()
  await tab(page, '예약')
  await expect(page.locator('.reservation-list')).toContainText(
    '체크인 오후 4시',
  )
  await page.getByRole('button', { name: '파리 숙소 일정에 복사' }).click()
  await expect(
    page.getByRole('button', { name: '파리 숙소 일정에 복사' }),
  ).toBeDisabled()
  await tab(page, '일정')
  await expect(page.locator('.timeline-item')).toContainText('파리 숙소')
  await expect(page.getByLabel('파리 숙소 메모')).toHaveValue(
    '예약 번호: PARIS-TEST-42\n체크인 오후 4시',
  )
  await tab(page, '예약')
  await page.getByRole('button', { name: '파리 숙소 예약 삭제' }).click()
  await page.getByRole('button', { name: '실행 취소' }).click()
  await expect(page.locator('.reservation-list')).toContainText('PARIS-TEST-42')
})

test('통화별 경비·예산과 지출 수정·삭제 취소', async ({ page }) => {
  await customTrip(page)
  await tab(page, '가계부')
  await page.getByText('통화별 예산 설정', { exact: true }).click()
  await page.getByLabel('예산 통화').selectOption('EUR')
  await page.getByLabel('예산 금액').fill('100')
  await page.getByRole('button', { name: '예산 저장', exact: true }).click()
  for (const [title, amount, currency] of [
    ['저녁 식사', '30.50', 'EUR'],
    ['기차표', '80', 'EUR'],
    ['공항버스', '15000', 'KRW'],
  ]) {
    await page.getByRole('button', { name: '지출 추가', exact: true }).click()
    await page.getByLabel('지출 이름').fill(title)
    await page.getByLabel('지출 통화', { exact: true }).selectOption(currency)
    await page.getByLabel('금액', { exact: true }).fill(amount)
    await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  }
  await expect(page.locator('.expense-totals')).toContainText('€110.50')
  await expect(page.locator('.expense-totals')).toContainText('₩15,000')
  await expect(page.locator('.over-budget')).toContainText('€10.50')
  await page.getByRole('button', { name: '기차표 지출 수정' }).click()
  await page.getByLabel('금액', { exact: true }).fill('60')
  await page.getByRole('button', { name: '지출 수정 저장' }).click()
  await expect(page.locator('.expense-totals')).toContainText('€90.50')
  await page.getByRole('button', { name: '공항버스 지출 삭제' }).click()
  await page.getByRole('button', { name: '실행 취소' }).click()
  await page.reload()
  await navigate(page, '내 여행')
  await tab(page, '가계부')
  await expect(page.locator('.expense-totals')).toContainText('€90.50')
  await expect(page.locator('.expense-totals')).toContainText('₩15,000')
})

test('독립 여행 백업 복원과 잘못된 파일 거부', async ({ page }) => {
  await customTrip(page)
  await customStop(page, '파리 숙소', '숙소')
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  const backup = await page.getByLabel('내보낸 여행 내용').inputValue()
  const parsed = JSON.parse(backup)
  const original = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  parsed.trips[0].days[0][0].custom.link = 'javascript:alert(1)'
  await page.getByLabel('백업 내용 붙여넣기').fill(JSON.stringify(parsed))
  await page.getByRole('button', { name: '백업 내용 확인' }).click()
  await expect(page.getByRole('alert')).toContainText(
    '유효한 J★Do 여행 백업이 아니에요',
  )
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(original)
  await page.evaluate(() => {
    localStorage.removeItem('jido-travel-v1')
    localStorage.removeItem('jdo-guide-catalog-v1')
  })
  await page.reload()
  await navigate(page, '내 여행')
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.getByLabel('백업 내용 붙여넣기').fill(backup)
  await page.getByRole('button', { name: '백업 내용 확인' }).click()
  await page.getByRole('button', { name: '여행 복사본 가져오기' }).click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.trip-banner')).toContainText('파리에서 로마까지')
  await expect(page.getByLabel('파리 숙소 메모')).toHaveValue(
    '예약 확인하고 출발',
  )
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.timeline-item')).toContainText('파리 숙소')
})

test('기존 단일 도시 데이터가 여러 도시 구조에서도 보존', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: ['kyoto'],
        savedPlaces: ['kiyomizu'],
        trips: [
          {
            id: 'legacy-trip',
            title: '예전 교토 여행',
            cityId: 'kyoto',
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            travelers: 2,
            days: [
              [
                {
                  id: 'old-stop',
                  placeId: 'kiyomizu',
                  time: '08:30',
                  note: '예전 메모',
                },
              ],
              [],
            ],
          },
        ],
      }),
    ),
  )
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue('예전 메모')
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByRole('dialog').getByLabel('마지막 날').fill('2026-11-03')
  await page.getByRole('button', { name: '변경사항 저장' }).click()
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.day-tab')).toHaveCount(3)
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue('예전 메모')
})

test('320px 여러 도시 관리와 예약·경비 입력에 가로 넘침 없음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await customTrip(page)
  for (const name of ['일정', '동선', '예약', '준비물', '가계부']) {
    await tab(page, name)
    if (name === '예약')
      await page
        .getByRole('button', { name: '예약 정보 추가', exact: true })
        .click()
    if (name === '가계부')
      await page.getByRole('button', { name: '지출 추가', exact: true }).click()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      name,
    ).toBe(false)
  }
})

test('없는 도시 검색에서 바로 자유여행을 시작', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('도시 또는 나라 검색').fill('리스본')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await page
    .getByRole('button', { name: '직접 입력해 여행 만들기', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByLabel('도시 이름', { exact: true }),
  ).toHaveValue('리스본')
  await page
    .getByRole('dialog')
    .getByLabel('국가', { exact: true })
    .fill('포르투갈')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.trip-banner')).toContainText('리스본')
})

test('가이드 장소도 독립 백업으로 복원되고 일부 손상이 다른 여행을 지우지 않음', async ({
  page,
}) => {
  await page.goto('/')
  await navigate(page, '내 여행')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await page.getByLabel('첫날에 추천 장소 3곳 넣어두기').check()
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  if (
    await page
      .locator('.stop-card')
      .filter({ has: page.getByLabel('기요미즈데라 메모') })
      .locator('.stop-edit-details:not([open]) > summary')
      .count()
  )
    await page
      .locator('.stop-card')
      .filter({ has: page.getByLabel('기요미즈데라 메모') })
      .locator('.stop-edit-details:not([open]) > summary')
      .click()
  await page.getByLabel('기요미즈데라 메모').fill('가이드 없이도 보관할 메모')
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  const backup = await page.getByLabel('내보낸 여행 내용').inputValue()
  expect(JSON.parse(backup).trips[0].days[0][0].custom.name).toBe(
    '기요미즈데라',
  )
  await page.getByLabel('백업 내용 붙여넣기').fill(backup)
  await page.getByRole('button', { name: '백업 내용 확인' }).click()
  await page.getByRole('button', { name: '여행 복사본 가져오기' }).click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue(
    '가이드 없이도 보관할 메모',
  )
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    stored.trips.push({ id: 'damaged', days: 'invalid' })
    localStorage.setItem('jido-travel-v1', JSON.stringify(stored))
  })
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue(
    '가이드 없이도 보관할 메모',
  )
  await expect(page.getByLabel('나의 여행').locator('option')).toHaveCount(2)
})

test('복구본 저장이 실패하면 원본 여행 데이터를 덮어쓰지 않음', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem('jido-travel-v1', '{damaged-travel-data'),
  )
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-travel-v1-recovery')
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('저장할 수 없어요')
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe('{damaged-travel-data')
})
