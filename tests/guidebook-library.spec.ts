import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { openTrips } from './navigation'
const manifest = JSON.parse(readFileSync('guidebooks/manifest.json', 'utf8'))
const entry = manifest.books.find((b: any) => b.id === 'book-hanoi')
const body = readFileSync('guidebooks/' + entry.file, 'utf8')
const guide = JSON.parse(body)
const key = 'jdo-guidebooks-v1'
const base =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/guidebooks/'
const trip = {
  id: 'private',
  title: '보존 여행',
  cityId: 'kyoto',
  startDate: '2026-11-01',
  endDate: '2026-11-01',
  travelers: 1,
  days: [
    [
      {
        id: 'original-stop',
        placeId: 'kiyomizu',
        time: '',
        note: '비공개 메모',
      },
    ],
  ],
}
const raw = JSON.stringify({
  version: 1,
  savedCities: ['kyoto'],
  savedPlaces: ['kiyomizu'],
  trips: [trip],
})
async function boot(page: Page, cache?: unknown) {
  await page.addInitScript(
    ({ raw, key, cache }) => {
      if (!sessionStorage.getItem('seeded-book')) {
        sessionStorage.setItem('seeded-book', 'yes')
        localStorage.setItem('jido-travel-v1', raw)
        if (cache !== undefined)
          localStorage.setItem(
            key,
            typeof cache === 'string' ? cache : JSON.stringify(cache),
          )
      }
      localStorage.setItem('jdo-content-auto-v1', 'false')
    },
    { raw, key, cache },
  )
  await page.goto('/')
  await expect(page.locator('.travel-home')).toBeVisible()
}
async function library(page: Page) {
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  await page.getByRole('button', { name: '가이드북', exact: true }).click()
  return page.getByRole('dialog')
}
async function row(page: Page) {
  const dialog = await library(page)
  await dialog
    .getByRole('textbox', { name: '가이드북 나라·도시 검색' })
    .fill('하노이')
  return dialog.locator('.guidebook-row')
}
test('reviewed library is 24 cities and 14 countries; all immutable bodies match metadata', async () => {
  expect(manifest.books).toHaveLength(24)
  expect(new Set(manifest.books.map((b: any) => b.country)).size).toBe(14)
  for (const b of manifest.books) {
    const bytes = readFileSync('guidebooks/' + b.file)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(b.revision)
    expect(bytes.length).toBe(b.bytes)
    const g = JSON.parse(bytes.toString())
    expect(g.places).toHaveLength(6)
    expect(g.sections.length).toBeGreaterThanOrEqual(6)
    expect(g.sources.length).toBeGreaterThan(0)
    expect(g.city.timeZone).toBeTruthy()
    for (const p of g.places) {
      expect(p.lat).toBeUndefined()
      expect(p.lng).toBeUndefined()
      expect(p.id.startsWith(b.id + '-')).toBeTruthy()
    }
  }
})
test('only selected city downloads; opening offline after restart preserves private records', async ({
  page,
}) => {
  const requests: string[] = []
  await page.route(base + '**', (r) => {
    requests.push(r.request().url())
    expect(r.request().method()).toBe('GET')
    expect(r.request().postData()).toBeNull()
    return r.fulfill({ body, contentType: 'application/json' })
  })
  await boot(page)
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  const r = await row(page)
  await r.getByRole('button', { name: '불러오기', exact: true }).click()
  await expect(r.getByText('기기에 저장됨')).toBeVisible()
  expect(requests).toEqual([base + entry.file])
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
  await page.reload()
  await page.route(base + '**', (r) => r.abort())
  const saved = await row(page)
  await saved.getByRole('button', { name: '열기', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('도시 한눈에', { exact: true })).toBeVisible()
  await dialog.getByText('공항에서 숙소까지', { exact: true }).click()
  await expect(dialog.getByText(/노이바이/)).toBeVisible()
  await dialog.getByRole('tab', { name: '관광', exact: true }).click()
  await expect(dialog.getByText('호안끼엠 호수', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})
for (const mode of ['hash', 'size', 'network', 'quota'] as const)
  test(`download ${mode} failure never replaces private records or claims saved`, async ({
    page,
  }) => {
    await boot(page)
    if (mode === 'quota')
      await page.evaluate((key) => {
        const old = Storage.prototype.setItem
        Storage.prototype.setItem = function (k, v) {
          if (k === key) throw new DOMException('full', 'QuotaExceededError')
          old.call(this, k, v)
        }
      }, key)
    await page.route(base + '**', (r) =>
      mode === 'network'
        ? r.abort()
        : r.fulfill({
            body:
              mode === 'hash'
                ? body.replace('하노이', '하노X')
                : mode === 'size'
                  ? body + ' '
                  : body,
            contentType: 'application/json',
          }),
    )
    const before = await page.evaluate(() =>
      localStorage.getItem('jido-travel-v1'),
    )
    const r = await row(page)
    await r.getByRole('button', { name: '불러오기', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await expect(
      r.getByRole('button', { name: '열기', exact: true }),
    ).toHaveCount(0)
    expect(
      await page.evaluate((key) => localStorage.getItem(key), key),
    ).toBeNull()
    expect(
      await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
    ).toBe(before)
  })
test('unreadable guidebook cache is preserved before replacing it', async ({
  page,
}) => {
  await boot(page, 'broken-book-cache')
  await page.route(base + '**', (r) =>
    r.fulfill({ body, contentType: 'application/json' }),
  )
  const r = await row(page)
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '읽지 못했어요',
  )
  await r.getByRole('button', { name: '불러오기', exact: true }).click()
  await expect(r.getByText('기기에 저장됨')).toBeVisible()
  expect(
    await page.evaluate(
      (key) =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(key + '-unreadable-'))
          .map((k) => localStorage.getItem(k)),
      key,
    ),
  ).toEqual(['broken-book-cache'])
})
test('invalid remote list leaves bundled library available and 320px buttons horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await boot(page)
  await page.route(base + '**', (r) =>
    r.fulfill({
      body: JSON.stringify({
        ...manifest,
        books: [{ ...entry, file: '../../private.json' }],
      }),
      contentType: 'application/json',
    }),
  )
  const d = await library(page)
  await d.getByRole('button', { name: '목록 새로고침' }).click()
  await expect(d.getByRole('alert')).toBeVisible()
  await expect(d.locator('.guidebook-row')).toHaveCount(24)
  expect(
    await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy()
  await d.getByRole('textbox').fill('베트남')
  await expect(d.locator('.guidebook-row')).toHaveCount(4)
})
test('a trip snapshot survives missing downloaded cache, including timezone and memo', async ({
  page,
}) => {
  const p = guide.places[0]
  const travel = {
    version: 1,
    savedCities: [],
    savedPlaces: [],
    trips: [
      {
        ...trip,
        cityId: guide.id,
        destinations: [
          {
            id: guide.id,
            name: guide.city.name,
            country: guide.city.country,
            guideCityId: guide.id,
            timeZone: guide.city.timeZone,
          },
        ],
        days: [
          [
            {
              id: 'book-stop',
              placeId: p.id,
              time: '',
              note: '비공개 메모',
              custom: {
                name: p.name,
                kind: p.category,
                address: p.address,
                link: '',
                destinationId: guide.id,
                catalogPlaceId: p.id,
              },
            },
          ],
        ],
      },
    ],
  }
  await boot(page)
  await page.evaluate((v) => {
    localStorage.setItem('jido-travel-v1', JSON.stringify(v))
    localStorage.removeItem('jdo-guidebooks-v1')
  }, travel)
  await page.reload()
  await openTrips(page)
  await expect(page.getByText(p.name, { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText('비공개 메모', { exact: true }).first(),
  ).toBeVisible()
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!),
  )
  expect(saved.trips[0].destinations[0].timeZone).toBe('Asia/Ho_Chi_Minh')
  expect(saved.trips[0].days[0][0].time).toBe('')
})

test('creating a trip from a downloaded place writes an independent untimed snapshot', async ({
  page,
}) => {
  await boot(page, {
    schemaVersion: 1,
    books: [{ revision: entry.revision, guide }],
    retainedPlaces: [],
  })
  const r = await row(page)
  await r.getByRole('button', { name: '열기', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  await page
    .getByRole('button', { name: '호안끼엠 호수 자세히 보기', exact: true })
    .first()
    .click()
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  await page
    .getByRole('button', { name: '이 장소와 여행 시작하기', exact: true })
    .click()
  await page.getByLabel('출발일', { exact: true }).fill('2026-11-10')
  await page.getByLabel('마지막 날', { exact: true }).fill('2026-11-11')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!),
  )
  const created = saved.trips.find((t: any) => t.cityId === 'book-hanoi')
  expect(created).toBeTruthy()
  expect(created.days[0][0].time).toBe('')
  expect(created.days[0][0].custom.name).toBe('호안끼엠 호수')
  expect(created.destinations[0].timeZone).toBe('Asia/Ho_Chi_Minh')
  await page.evaluate((key) => localStorage.removeItem(key), key)
  await page.reload()
  await openTrips(page)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.length,
    ),
  ).toBe(2)
})
test('updated book keeps historical places and another downloaded city', async ({
  page,
}) => {
  const old = structuredClone(guide)
  old.updatedAt = '2026-10-27T12:00:00.000Z'
  old.places = [{ ...old.places[0], id: 'book-hanoi-previous-place' }]
  const otherEntry = manifest.books.find((b: any) => b.id === 'book-paris')
  const other = JSON.parse(
    readFileSync('guidebooks/' + otherEntry.file, 'utf8'),
  )
  await boot(page, {
    schemaVersion: 1,
    books: [
      { revision: 'a'.repeat(64), guide: old },
      { revision: otherEntry.revision, guide: other },
    ],
    retainedPlaces: [],
  })
  await page.route(base + '**', (r) =>
    r.fulfill({ body, contentType: 'application/json' }),
  )
  const r = await row(page)
  await r.getByRole('button', { name: '업데이트', exact: true }).click()
  await expect(r.getByText('기기에 저장됨')).toBeVisible()
  const cache = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  )
  expect(cache.books).toHaveLength(2)
  expect(
    cache.retainedPlaces.some((p: any) => p.id === 'book-hanoi-previous-place'),
  ).toBeTruthy()
})
test('a newer installed book never offers an older bundled download', async ({
  page,
}) => {
  const newer = structuredClone(guide)
  newer.updatedAt = '2026-10-29T12:00:00.000Z'
  await boot(page, {
    schemaVersion: 1,
    books: [{ revision: 'b'.repeat(64), guide: newer }],
    retainedPlaces: [],
  })
  await page.route(base + '**', (r) =>
    r.fulfill({ body, contentType: 'application/json' }),
  )
  const r = await row(page)
  await expect(r.getByText('기기에 저장됨')).toBeVisible()
  await expect(
    r.getByRole('button', { name: '업데이트', exact: true }),
  ).toHaveCount(0)
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).books[0].revision,
      key,
    ),
  ).toBe('b'.repeat(64))
})

test('download continues after closing the library without changing the trip', async ({
  page,
}) => {
  await boot(page)
  let deliver!: () => void
  const gate = new Promise<void>((resolve) => {
    deliver = resolve
  })
  await page.route(base + '**', async (r) => {
    await gate
    await r.fulfill({ body, contentType: 'application/json' })
  })
  const r = await row(page)
  await r.getByRole('button', { name: '불러오기', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  deliver()
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
    .not.toBeNull()
  const saved = await row(page)
  await expect(saved.getByText('기기에 저장됨')).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[0][0]
          .note,
    ),
  ).toBe('비공개 메모')
})
test('a private guide with the same ID retains priority and visible authored text', async ({
  page,
}) => {
  const personal = structuredClone(guide)
  personal.city.description = '내가 작성한 도시 설명'
  personal.sections = [
    {
      id: 'personal-body',
      title: '개인 안내',
      body: '개인 본문은 항상 보여야 함',
    },
  ]
  await page.addInitScript(
    (p) =>
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({ available: [p], retained: [], usingServer: true }),
      ),
    personal,
  )
  await boot(page, {
    schemaVersion: 1,
    books: [{ revision: entry.revision, guide }],
    retainedPlaces: [],
  })
  const r = await row(page)
  await r.getByRole('button', { name: '열기', exact: true }).click()
  await expect(
    page.getByText('개인 본문은 항상 보여야 함', { exact: true }),
  ).toBeVisible()
})
for (const mode of [
  'namespace',
  'timezone',
  'oversize',
  'future-build',
] as const)
  test(`reject incompatible ${mode} before installing`, async ({ page }) => {
    await boot(page)
    const changed = structuredClone(guide)
    if (mode === 'namespace') changed.places[0].id = 'kiyomizu'
    if (mode === 'timezone') delete changed.city.timeZone
    let payload = JSON.stringify(changed)
    if (mode === 'oversize') payload = ' '.repeat(513 * 1024)
    const revision = createHash('sha256').update(payload).digest('hex')
    const changedEntry = {
      ...entry,
      revision,
      file: `${entry.id}-${revision}.json`,
      bytes: mode === 'oversize' ? entry.bytes : Buffer.byteLength(payload),
      minBuild: mode === 'future-build' ? 99999 : entry.minBuild,
    }
    await page.route(base + '**', (r) =>
      r.fulfill({
        body: r.request().url().endsWith('manifest.json')
          ? JSON.stringify({ ...manifest, books: [changedEntry] })
          : payload,
        contentType: 'application/json',
      }),
    )
    const d = await library(page)
    await d.getByRole('button', { name: '목록 새로고침' }).click()
    await expect(d.getByRole('status')).toBeVisible()
    if (mode === 'future-build')
      await expect(
        d.getByRole('button', { name: '앱 업데이트 필요' }),
      ).toBeDisabled()
    else {
      await d.getByRole('button', { name: '불러오기', exact: true }).click()
      await expect(d.getByRole('alert')).toBeVisible()
    }
    expect(
      await page.evaluate((key) => localStorage.getItem(key), key),
    ).toBeNull()
  })
