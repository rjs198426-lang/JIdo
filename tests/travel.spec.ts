import { expect, test, type Page } from '@playwright/test'
import { cities, places } from '../src/data'

async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}

async function createTrip(page: Page, title = '교토 가을 여행') {
  await navigate(page, '내 여행')
  await page.getByRole('button', { name: '첫 여행 만들기' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await dialog.getByLabel('첫날에 추천 장소 3곳 넣어두기').check()
  await dialog.getByLabel('여행 이름').fill(title)
  await dialog.getByLabel('출발일').fill('2026-11-05')
  await dialog.getByLabel('마지막 날').fill('2026-11-07')
  await dialog
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.trip-banner')).toContainText(title)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('도시 검색, 지역 필터와 여행 상세 정보', async ({ page }) => {
  await page.getByLabel('도시 또는 나라 검색').fill('교토')
  await page.getByRole('button', { name: '여행지 찾기' }).click()
  await expect(page.locator('.city-card')).toHaveCount(1)
  await page.getByRole('button', { name: '교토 여행지 자세히 보기' }).click()
  await expect(page.getByRole('dialog')).toContainText('한국과 시차 없음')
  await expect(page.getByRole('dialog')).toContainText('니시키 시장')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '검색어 지우기' }).click()
  await page.getByRole('button', { name: '동남아', exact: true }).click()
  await expect(page.locator('.city-card')).toHaveCount(
    cities.filter((city) => city.region === '동남아').length,
  )
  await page.getByRole('tab', { name: '가볼 만한 곳' }).click()
  await page
    .locator('.category-row')
    .getByRole('button', { name: '카페', exact: true })
    .click()
  const southeastCities = cities
    .filter((city) => city.region === '동남아')
    .map((city) => city.id)
  const cafes = places.filter(
    (place) =>
      southeastCities.includes(place.cityId) && place.category === '카페',
  )
  await expect(page.locator('.place-card')).toHaveCount(
    Math.min(24, cafes.length),
  )
  for (const card of await page.locator('.place-card').all())
    await expect(card).toContainText('카페')
  await page.getByLabel('여행지와 장소 검색').fill('없는 여행지')
  await expect(
    page.getByText('검색 결과가 없어요', { exact: true }),
  ).toBeVisible()
})

test('주 메뉴는 홈·내 여행·여행지 순서이며 저장 UI를 제거', async ({
  page,
}) => {
  const navigation = page.locator('.desktop-nav:visible, .bottom-nav:visible')
  await expect(navigation.getByRole('button')).toHaveText([
    '홈',
    '내 여행',
    '여행지',
  ])
  await navigate(page, '여행지')
  await expect(page.locator('.save-button')).toHaveCount(0)
  await page.getByRole('button', { name: '교토 여행지 자세히 보기' }).click()
  await expect(page.getByRole('dialog').locator('.save-button')).toHaveCount(0)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  await expect(page.locator('.travel-home')).toBeVisible()
})

test('여행 생성, 일정 시간·메모 편집, 순서 이동 및 장소 추가', async ({
  page,
}) => {
  await createTrip(page)
  await expect(page.locator('.timeline-item')).toHaveCount(3)
  await page.getByLabel('기요미즈데라 방문 시간').fill('09:30')
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
  await page
    .getByLabel('기요미즈데라 메모')
    .fill('아침 일찍 출발, 편한 신발 챙기기')
  await page
    .getByRole('button', { name: '니시키 시장 위로 이동', exact: true })
    .click()
  await expect(page.locator('.timeline-item').nth(1)).toContainText(
    '니시키 시장',
  )
  await page
    .getByRole('button', {
      name: '후시미 이나리 신사 일정에서 삭제',
      exact: true,
    })
    .click()
  await expect(page.locator('.timeline-item')).toHaveCount(2)
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await page
    .getByRole('button', { name: '첫 장소 추가하기', exact: true })
    .click()
  await page.getByRole('button', { name: '추천 장소에서 선택' }).click()
  await page
    .getByRole('button', {
      name: '기온 시라카와 산책 일정에 추가',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('button', {
      name: '기온 시라카와 산책 추가됨',
      exact: true,
    }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.timeline-item')).toHaveCount(1)
  await expect(page.locator('.timeline-item')).toContainText(
    '기온 시라카와 산책',
  )
  await page.reload()
  await navigate(page, '내 여행')
  await page.getByRole('tab', { name: /DAY 1/ }).click()
  await expect(page.getByLabel('기요미즈데라 방문 시간')).toHaveValue('09:30')
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue(
    '아침 일찍 출발, 편한 신발 챙기기',
  )
  await expect(page.locator('.timeline-item').nth(1)).toContainText(
    '니시키 시장',
  )
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(page.locator('.timeline-item')).toHaveCount(1)
})

test('잘못된 여행 날짜는 저장하지 않음', async ({ page }) => {
  await navigate(page, '내 여행')
  await page.getByRole('button', { name: '첫 여행 만들기' }).click()
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await page.getByLabel('출발일').fill('2026-11-10')
  await page.getByLabel('마지막 날').fill('2026-11-05')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    '마지막 날은 출발일과 같거나 이후',
  )
  await page.getByLabel('마지막 날').fill('2026-12-20')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('최대 21일')
  await page.getByLabel('마지막 날').fill('2026-11-10')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.day-tab')).toHaveCount(1)
})

test('장소 상세에서 새로운 여행 만들기 및 기존 일정에 추가', async ({
  page,
}) => {
  await navigate(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: '지도에서 위치 보기' }),
  ).toHaveAttribute('href', /google.com\/maps\/search/)
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  await page.getByRole('button', { name: '이 장소와 여행 시작하기' }).click()
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.timeline-item')).toHaveCount(1)
  await expect(page.locator('.timeline-item')).toContainText('기요미즈데라')
  await navigate(page, '여행지')
  await page.getByRole('tab', { name: /여행 도시/ }).click()
  await page.getByRole('button', { name: '교토 여행지 자세히 보기' }).click()
  await page
    .getByRole('button', { name: '니시키 시장 자세히 보기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  await page.getByLabel('어느 날에 갈까요?').selectOption('1')
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  await expect(page.locator('.timeline-item')).toHaveCount(1)
  await expect(page.locator('.timeline-item')).toContainText('니시키 시장')
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('여행 삭제 확인과 재시작 후 삭제 유지', async ({ page }) => {
  await createTrip(page, '삭제 테스트 여행')
  await page.getByRole('button', { name: '여행 삭제', exact: true }).click()
  await page.getByRole('button', { name: '돌아가기', exact: true }).click()
  await expect(page.locator('.trip-banner')).toBeVisible()
  await page.getByRole('button', { name: '여행 삭제', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '여행 삭제', exact: true })
    .click()
  await expect(
    page.getByText('설레는 여행을 시작해볼까요?', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.trip-banner')).toHaveCount(0)
})

test('손상된 저장 데이터 복구와 오프라인 사진 표시', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.evaluate(() =>
    localStorage.setItem('jido-travel-v1', '{invalid json'),
  )
  await page.reload()
  await expect(page.getByLabel('도시 또는 나라 검색')).toBeVisible()
  await navigate(page, '여행지')
  await expect(page.locator('.city-card')).toHaveCount(cities.length)
  await page
    .locator('main')
    .evaluate((el) => window.scrollTo(0, el.scrollHeight))
  await expect
    .poll(() =>
      page
        .locator('img')
        .evaluateAll((images) =>
          images.every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        ),
    )
    .toBe(true)
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: ['invalid'],
        savedPlaces: [],
        trips: [],
      }),
    ),
  )
  await page.reload()
  await navigate(page, '내 여행')
  await expect(
    page.getByText('설레는 여행을 시작해볼까요?', { exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('좁은 모바일 화면과 모달의 가로 넘침 방지', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const hasOverflow = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  expect(await hasOverflow()).toBe(false)
  await navigate(page, '여행지')
  await page.getByRole('button', { name: '교토 여행지 자세히 보기' }).click()
  expect(await hasOverflow()).toBe(false)
  await page
    .getByRole('button', { name: '교토 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await hasOverflow()).toBe(false)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await navigate(page, '내 여행')
  await createTrip(page)
  expect(await hasOverflow()).toBe(false)
})

test('Android 시스템 바 여백과 모달 키보드 포커스', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '28px')
    document.documentElement.style.setProperty(
      '--safe-area-inset-bottom',
      '24px',
    )
  })
  await expect(page.locator('.header')).toHaveCSS('padding-top', '28px')
  await expect(page.locator('.bottom-nav')).toHaveCSS('padding-bottom', '34px')
  await navigate(page, '내 여행')
  await page.getByRole('button', { name: '첫 여행 만들기' }).click()
  await expect(
    page.getByRole('button', { name: '닫기', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    page.getByRole('button', { name: '내 여행 만들기', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: '닫기', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '첫 여행 만들기' }),
  ).toBeFocused()
})

test('홈 장소 검색은 장소 결과로 이동하고 남아 있던 필터를 초기화', async ({
  page,
}) => {
  await navigate(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page
    .locator('.category-row')
    .getByRole('button', { name: '카페', exact: true })
    .click()
  await navigate(page, '홈')
  await page.getByLabel('도시 또는 나라 검색').fill('  nishiki   KYOTO  ')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await expect(page.getByRole('tab', { name: /가볼 만한 곳/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.place-card')).toHaveCount(1)
  await expect(page.locator('.place-card')).toContainText('니시키 시장')
  await page.getByRole('tab', { name: /여행 도시/ }).click()
  await page.getByRole('button', { name: '일치하는 장소 보기' }).click()
  await expect(page.locator('.place-card')).toHaveCount(1)
})

test('여행 편집과 날짜 이동은 메모를 보존하며 일정이 있는 날의 삭제를 방지', async ({
  page,
}) => {
  await createTrip(page)
  await page.getByLabel('기요미즈데라 방문 시간').fill('08:45')
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
  await page.getByLabel('기요미즈데라 메모').fill('입장권 챙기기')
  if (
    await page
      .locator('.stop-card')
      .filter({ has: page.getByLabel('기요미즈데라 이동할 날짜') })
      .locator('.stop-edit-details:not([open]) > summary')
      .count()
  )
    await page
      .locator('.stop-card')
      .filter({ has: page.getByLabel('기요미즈데라 이동할 날짜') })
      .locator('.stop-edit-details:not([open]) > summary')
      .click()
  await page.getByLabel('기요미즈데라 이동할 날짜').selectOption('2')
  await expect(page.getByRole('tab', { name: /DAY 3/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue(
    '입장권 챙기기',
  )
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('마지막 날').fill('2026-11-06')
  await dialog.getByRole('button', { name: '변경사항 저장' }).click()
  await expect(dialog.getByRole('alert')).toContainText('DAY 3에 일정이 있어요')
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  if (
    await page
      .locator('.stop-card')
      .filter({ has: page.getByLabel('기요미즈데라 이동할 날짜') })
      .locator('.stop-edit-details:not([open]) > summary')
      .count()
  )
    await page
      .locator('.stop-card')
      .filter({ has: page.getByLabel('기요미즈데라 이동할 날짜') })
      .locator('.stop-edit-details:not([open]) > summary')
      .click()
  await page.getByLabel('기요미즈데라 이동할 날짜').selectOption('1')
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('여행 이름').fill('날짜를 바꾼 교토 여행')
  await dialog.getByLabel('출발일').fill('2026-12-10')
  await dialog.getByLabel('마지막 날').fill('2026-12-11')
  await dialog.getByLabel('함께하는 인원').selectOption('3')
  await dialog.getByRole('button', { name: '변경사항 저장' }).click()
  await expect(page.locator('.day-tab')).toHaveCount(2)
  await expect(page.locator('.trip-banner')).toContainText('3명')
  await expect(page.getByLabel('기요미즈데라 방문 시간')).toHaveValue('08:45')
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.trip-banner')).toContainText(
    '날짜를 바꾼 교토 여행',
  )
  await navigate(page, '내 여행')
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(page.getByLabel('기요미즈데라 메모')).toHaveValue(
    '입장권 챙기기',
  )
  await expect(page.getByLabel('기요미즈데라 방문 시간')).toHaveValue('08:45')
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toContainText(
    '12월 11일',
  )
})

test('추천 장소에서 일정에 추가하고 같은 날짜 중복 이동을 방지', async ({
  page,
}) => {
  await createTrip(page)
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await page
    .getByRole('button', { name: '첫 장소 추가하기', exact: true })
    .click()
  await page.getByRole('button', { name: '추천 장소에서 선택' }).click()
  await page.getByLabel('일정에 추가할 장소 검색').fill('기요미즈데라')
  await expect(page.locator('.picker-item')).toHaveCount(1)
  await page
    .getByRole('button', { name: '기요미즈데라 일정에 추가', exact: true })
    .click()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  // DAY 1 already contains this place, so moving it there must not duplicate it.
  await expect(
    page.getByLabel('기요미즈데라 이동할 날짜').locator('option[value="0"]'),
  ).toHaveJSProperty('disabled', true)
  await page
    .getByLabel('기요미즈데라 이동할 날짜')
    .evaluate((element: HTMLSelectElement) => {
      element.value = '0'
      element.dispatchEvent(new Event('change', { bubbles: true }))
    })
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.timeline-item')).toHaveCount(1)
  await page.reload()
  await navigate(page, '내 여행')
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(page.locator('.timeline-item')).toHaveCount(1)
})

test('320px 일정 편집 화면의 터치 영역과 가로 넘침', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await createTrip(page)
  const button = page.getByRole('button', {
    name: '니시키 시장 위로 이동',
    exact: true,
  })
  const size = await button.boundingBox()
  expect(size!.width).toBeGreaterThanOrEqual(44)
  expect(size!.height).toBeGreaterThanOrEqual(44)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
})

test('마지막으로 선택한 여행을 홈과 재시작에서 이어보기', async ({ page }) => {
  await createTrip(page, '첫 번째 교토 여행')
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('어디로 떠나세요?')
    .selectOption('kyoto')
  await page.getByRole('dialog').getByLabel('여행 이름').fill('두 번째 여행')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.trip-banner')).toContainText('두 번째 여행')
  await navigate(page, '내 여행')
  await page.getByLabel('나의 여행').selectOption({ index: 0 })
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.trip-banner')).toContainText('첫 번째 교토 여행')
})
