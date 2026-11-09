import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { openWorkspace } from './navigation'
const base =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/guidebooks/'
const manifest = JSON.parse(readFileSync('guidebooks/manifest.json', 'utf8'))
const paris = manifest.books.find(
  (book: { id: string }) => book.id === 'book-paris',
)
async function boot(page: Page, failBody = false) {
  const external: string[] = []
  await page.clock.setFixedTime(new Date('2026-11-09T03:00:00Z'))
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith('http://127.0.0.1:')) return route.continue()
    external.push(url)
    if (url === base + 'manifest.json') return route.fulfill({ json: manifest })
    if (url === base + paris.file && !failBody)
      return route.fulfill({
        contentType: 'application/json',
        body: readFileSync('guidebooks/' + paris.file),
      })
    return route.abort()
  })
  await page.goto('/')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .waitFor()
  return external
}
async function create(page: Page) {
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const d = page.getByRole('dialog')
  await d.getByLabel('어디로 떠나세요?').selectOption('guam')
  await d.getByLabel('출발일', { exact: true }).fill('2026-12-22')
  return d
}
const readStore = (page: Page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1') || '{"trips":[]}'),
  )

test('first launch explains the purpose and device storage without blocking setup', async ({
  page,
}) => {
  await boot(page)
  await expect(page.locator('.home-start-card')).toContainText(
    '일정·예약·준비물을 한곳에',
  )
  await expect(page.locator('.home-storage-note')).toContainText(
    '이 기기에 저장',
  )
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await create(page)
  await expect(page.getByRole('dialog').getByLabel('여행 이름')).toBeHidden()
  expect((await readStore(page)).trips).toEqual([])
})

test('future departure keeps a valid trip length, retains a later chosen end, and creates no automatic times', async ({
  page,
}) => {
  await boot(page)
  const d = await create(page)
  await expect(d.getByLabel('마지막 날', { exact: true })).toHaveValue(
    '2026-12-25',
  )
  await d.getByLabel('마지막 날', { exact: true }).fill('2026-12-26')
  await d.getByLabel('출발일', { exact: true }).fill('2026-12-24')
  await expect(d.getByLabel('마지막 날', { exact: true })).toHaveValue(
    '2026-12-26',
  )
  await expect(d.getByLabel('마지막 날', { exact: true })).toHaveAttribute(
    'min',
    '2026-12-24',
  )
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(d).toBeHidden()
  expect((await readStore(page)).trips[0]).toMatchObject({
    startDate: '2026-12-24',
    endDate: '2026-12-26',
    days: [[], [], []],
  })
})

test('a downloaded destination can be found during creation without submitting or losing dates', async ({
  page,
}) => {
  const external = await boot(page)
  const d = await create(page)
  await d
    .getByRole('button', { name: '다른 도시 가이드 찾기', exact: true })
    .click()
  await d.getByLabel('추가 도시 가이드 검색').fill('파리')
  await expect(
    d.getByRole('button', { name: '파리 가이드 받기' }),
  ).toBeVisible()
  await d.getByRole('button', { name: '파리 가이드 받기' }).click()
  await expect(d.getByLabel('어디로 떠나세요?')).toHaveValue(paris.id)
  expect((await readStore(page)).trips).toEqual([])
  await expect(d.getByLabel('출발일', { exact: true })).toHaveValue(
    '2026-12-22',
  )
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(d).toBeHidden()
  const trip = (await readStore(page)).trips[0]
  expect(trip.destinations[0]).toMatchObject({
    name: '파리',
    guideCityId: paris.id,
    timeZone: 'Europe/Paris',
  })
  expect(trip.days).toEqual([[], [], [], []])
  expect(
    external.every(
      (url) => url === base + 'manifest.json' || url === base + paris.file,
    ),
  ).toBe(true)
})

test('failed guide download leaves creation and drafts usable, including a direct city fallback', async ({
  page,
}) => {
  await boot(page, true)
  const d = await create(page)
  await d
    .getByRole('button', { name: '다른 도시 가이드 찾기', exact: true })
    .click()
  await d.getByLabel('추가 도시 가이드 검색').fill('파리')
  await d.getByRole('button', { name: '파리 가이드 받기' }).click()
  await expect(d.getByRole('alert')).toBeVisible()
  await expect(d.getByLabel('출발일', { exact: true })).toHaveValue(
    '2026-12-22',
  )
  expect((await readStore(page)).trips).toEqual([])
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await expect(d.getByLabel('추가 도시 가이드 검색')).toHaveValue('파리')
  await d.getByLabel('어디로 떠나세요?').selectOption('custom')
  await d.getByLabel('도시 이름', { exact: true }).fill('파리')
  await d.getByLabel('국가', { exact: true }).fill('프랑스')
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(d).toBeHidden()
  expect((await readStore(page)).trips[0].destinations[0]).toMatchObject({
    name: '파리',
    country: '프랑스',
  })
})

test('empty itinerary offers preparation actions and never implies a blank trip is ready', async ({
  page,
}) => {
  await boot(page)
  const d = await create(page)
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(page.locator('.schedule-first-place')).toContainText(
    '방문 시간은 나중에',
  )
  const before = JSON.stringify(await readStore(page))
  await page.getByRole('button', { name: '예약 기록하기', exact: true }).click()
  await expect(
    page.getByText('이미 예약한 항공·숙소·교통 정보를 기록하는 곳이에요.', {
      exact: false,
    }),
  ).toBeVisible()
  await openWorkspace(page, '여행 준비')
  await page.locator('.preparation-review > summary').click()
  await expect(page.locator('.trip-readiness')).toContainText(
    '아직 점검할 기록이 없어요',
  )
  await expect(page.locator('.trip-readiness')).toContainText(
    '입국 조건과 실제 예약 상태는 별도로 확인',
  )
  await page
    .getByRole('button', { name: '여권·통신 등 준비물 확인하기', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '기본 준비물 담기', exact: true }),
  ).toBeVisible()
  expect(JSON.stringify(await readStore(page))).toBe(before)
  await page
    .getByRole('button', { name: '기본 준비물 담기', exact: true })
    .click()
  expect((await readStore(page)).trips[0].checklist.length).toBeGreaterThan(5)
  expect(
    (await readStore(page)).trips[0].checklist.every(
      (item: { done: boolean }) => !item.done,
    ),
  ).toBe(true)
})

test('320–1440px first-use screens remain within the viewport with usable actions', async ({
  page,
}, info) => {
  await boot(page)
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const first = page.getByRole('button', {
      name: '첫 여행 만들기',
      exact: true,
    })
    expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(43.9)
  }
  const d = await create(page)
  await d
    .getByRole('button', { name: '다른 도시 가이드 찾기', exact: true })
    .click()
  await d.getByLabel('추가 도시 가이드 검색').fill('파리')
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true,
    )
  }
  await page.setViewportSize({ width: 393, height: 850 })
  await page.screenshot({ path: info.outputPath('first-trip-create.png') })
})

test('offline guidance distinguishes saved records from online features and never changes the trip', async ({
  page,
  context,
}) => {
  await boot(page)
  const d = await create(page)
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  await expect(d).toBeHidden()
  const before = JSON.stringify(await readStore(page))
  await context.setOffline(true)
  await expect(page.locator('.connection-notice')).toContainText(
    '지도·검색·새 가이드',
  )
  await page.getByRole('button', { name: '준비물 챙기기', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '기본 준비물 담기', exact: true }),
  ).toBeVisible()
  expect(JSON.stringify(await readStore(page))).toBe(before)
  await context.setOffline(false)
  await expect(page.locator('.connection-notice')).toHaveCount(0)
  expect(JSON.stringify(await readStore(page))).toBe(before)
})
