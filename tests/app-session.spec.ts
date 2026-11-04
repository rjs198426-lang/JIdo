import { test, expect, type Page } from '@playwright/test'
import { openTrips, openWorkspace } from './navigation'
const trip = {
  id: 'resume-a',
  title: '다시 볼 여행',
  cityId: 'kyoto',
  startDate: '2026-12-22',
  endDate: '2026-12-23',
  travelers: 1,
  days: [
    [],
    Array.from({ length: 25 }, (_, i) => ({
      id: 'stop-' + i,
      placeId: 'kiyomizu',
      time: '',
      note: '보존할 메모 ' + i,
    })),
  ],
}
async function boot(page: Page) {
  await page.addInitScript((trip) => {
    if (!sessionStorage.getItem('session-seed')) {
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [
            trip,
            { ...trip, id: 'resume-b', title: '다른 여행', days: [[], []] },
          ],
        }),
      )
      localStorage.setItem('jdo-active-trip-v1', trip.id)
      sessionStorage.setItem('session-seed', '1')
    }
    localStorage.setItem('jdo-content-auto-v1', 'false')
  }, trip)
  await page.goto('/')
}
const raw = (page: Page) =>
  page.evaluate(() => localStorage.getItem('jido-travel-v1'))
const flush = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
test('여행·날짜·작업·스크롤을 재실행 후 복원하고 런처는 현재 화면 유지', async ({
  page,
}) => {
  await boot(page)
  const before = await raw(page)
  await openTrips(page)
  await page
    .getByRole('tab', { name: 'DAY 2 · 12월 23일 (수)', exact: true })
    .click()
  await page.evaluate(() => scrollTo(0, 550))
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(550)
  await flush(page)
  await page.reload()
  await expect(page.locator('.trip-banner h2')).toHaveText(trip.title)
  await expect(
    page.getByRole('tab', { name: 'DAY 2 · 12월 23일 (수)', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect
    .poll(() => page.evaluate(() => Math.abs(scrollY - 550)))
    .toBeLessThan(3)
  await page.evaluate(() =>
    window.dispatchEvent(new Event('jido:launcher-open')),
  )
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(540)
  await openWorkspace(page, '가계부')
  await page.locator('.expense-filter-toggle').click()
  await page.getByLabel('지출 검색').fill('점심')
  await flush(page)
  await page.reload()
  await expect(
    page.getByRole('tab', { name: '가계부', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('지출 검색')).toHaveValue('점심')
  expect(await raw(page)).toBe(before)
})
test('여행 목록·검색어·설정 탭을 재실행 후 그대로 유지', async ({ page }) => {
  await boot(page)
  await openTrips(page)
  await page
    .getByRole('button', { name: '모든 여행 보기', exact: true })
    .click()
  await page.getByLabel('내 여행 검색').fill('다시')
  await flush(page)
  await page.reload()
  await expect(page.locator('.trip-library')).toBeVisible()
  await expect(page.getByLabel('내 여행 검색')).toHaveValue('다시')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByLabel('여행지와 장소 검색').fill('기온')
  await flush(page)
  await page.reload()
  await expect(page.getByLabel('여행지와 장소 검색')).toHaveValue('기온')
  await expect(page.getByRole('tab', { name: /가볼 만한 곳/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  await flush(page)
  await page.reload()
  await expect(page.locator('.settings-page')).toBeVisible()
})
test('도시 가이드의 선택 탭과 열린 상세창을 재실행 후 복원', async ({
  page,
}) => {
  await boot(page)
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .click()
  await page.locator('.city-guide-article > summary').first().click()
  await flush(page)
  await page.reload()
  await expect(page.locator('.city-guide-article').first()).toHaveAttribute(
    'open',
    '',
  )
  await page.getByRole('tab', { name: '맛집', exact: true }).click()
  await flush(page)
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    '교토 여행 가이드',
  )
  await expect(
    page.getByRole('tab', { name: '맛집', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Escape')
  await flush(page)
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('입력 중인 일정은 런처·재실행 후 초안을 유지하고 자동 저장하지 않음', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  const before = await raw(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '새 장소 추가', exact: true }).click()
  await page.getByPlaceholder('장소 이름 입력').fill('저장 전 초안')
  await page.evaluate(() =>
    window.dispatchEvent(new Event('jido:launcher-open')),
  )
  await expect(page.getByPlaceholder('장소 이름 입력')).toHaveValue(
    '저장 전 초안',
  )
  await flush(page)
  await page.reload()
  await expect(page.getByPlaceholder('장소 이름 입력')).toHaveValue(
    '저장 전 초안',
  )
  expect(await raw(page)).toBe(before)
})
test('복귀 정보 손상·삭제된 여행·저장소 거절은 기존 기록을 바꾸지 않음', async ({
  page,
}) => {
  await boot(page)
  const before = await raw(page)
  await page.evaluate(() =>
    localStorage.setItem('jido-last-screen-v1', 'broken'),
  )
  await page.reload()
  await expect(page.locator('.travel-home')).toBeVisible()
  expect(await raw(page)).toBe(before)
  await openTrips(page)
  await flush(page)
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    s.trips = []
    localStorage.setItem('jido-travel-v1', JSON.stringify(s))
  })
  await page.reload()
  await expect(
    page.getByRole('button', { name: '첫 여행 만들기', exact: true }),
  ).toBeVisible()
  await page.evaluate(() => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
      if (k === 'jido-last-screen-v1')
        throw new DOMException('test', 'QuotaExceededError')
      return write.call(this, k, v)
    }
  })
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  await expect(page.locator('.settings-page')).toBeVisible()
})

test('복원 준비 중 새 화면을 선택하면 과거 스크롤이 덮어쓰지 않음', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  await page
    .getByRole('tab', { name: 'DAY 2 · 12월 23일 (수)', exact: true })
    .click()
  await page.evaluate(() => scrollTo(0, 550))
  await flush(page)
  await page.addInitScript(() => {
    let release!: () => void
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    Object.defineProperty(document.fonts, 'ready', { get: () => waiting })
    ;(window as any).releaseResumeFonts = release
  })
  await page.reload()
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  await page.evaluate(() => (window as any).releaseResumeFonts())
  await expect(page.locator('.settings-page')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('jido-last-screen-v1')!).page,
      ),
    )
    .toBe('settings')
})

test('더 불러온 장소 목록과 스크롤도 재실행 후 유지', async ({ page }) => {
  await boot(page)
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByRole('button', { name: /장소 더 보기/ }).click()
  await expect(page.locator('.place-card')).toHaveCount(48)
  await page.evaluate(() => scrollTo(0, 800))
  await flush(page)
  await page.reload()
  await expect(page.locator('.place-card')).toHaveCount(48)
  await expect
    .poll(() => page.evaluate(() => Math.abs(scrollY - 800)))
    .toBeLessThan(3)
})
