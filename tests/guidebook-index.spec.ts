import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const bundled = JSON.parse(readFileSync('guidebooks/manifest.json', 'utf8'))
const base =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/guidebooks/'
const cacheKey = 'jdo-guidebook-index-v1'
const raw = JSON.stringify({
  version: 1,
  savedCities: ['kyoto'],
  savedPlaces: [],
  trips: [],
})
const fresh = {
  ...bundled,
  updatedAt: '2026-11-09T00:00:00Z',
  books: [
    ...bundled.books,
    {
      ...bundled.books[0],
      id: 'book-fixture-new',
      name: '새도시',
      english: 'Fixture City',
      revision: 'a'.repeat(64),
      file: `book-fixture-new-${'a'.repeat(64)}.json`,
      updatedAt: '2026-11-09T00:00:00Z',
    },
  ],
}
async function boot(page: Page, cache?: unknown, failCache = false) {
  await page.addInitScript(
    ({ raw, cacheKey, cache, failCache }) => {
      localStorage.setItem('jdo-content-auto-v1', 'false')
      if (!sessionStorage.getItem('index-seeded')) {
        sessionStorage.setItem('index-seeded', 'yes')
        localStorage.setItem('jido-travel-v1', raw)
        if (cache !== undefined)
          localStorage.setItem(
            cacheKey,
            typeof cache === 'string' ? cache : JSON.stringify(cache),
          )
      }
      if (failCache) {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (key === cacheKey)
            throw new DOMException('test quota', 'QuotaExceededError')
          original.call(this, key, value)
        }
      }
    },
    { raw, cacheKey, cache, failCache },
  )
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'J★Do 홈' })).toBeVisible()
}
async function library(page: Page) {
  if (await page.locator('.guidebook-library').isVisible())
    return page.getByRole('dialog')
  await page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  await page.getByRole('button', { name: '가이드북', exact: true }).click()
  return page.getByRole('dialog')
}

test('opening automatically discovers future cities, preserves the verified list across close and offline restart, and never downloads bodies', async ({
  page,
  context,
}) => {
  const requests: string[] = []
  await page.route(base + '**', (r) => {
    requests.push(r.request().url())
    expect(r.request().method()).toBe('GET')
    expect(r.request().postData()).toBeNull()
    return r.request().url() === base + 'manifest.json'
      ? r.fulfill({ json: fresh })
      : r.abort()
  })
  await boot(page)
  let d = await library(page)
  await expect(
    d.getByText(`받을 수 있는 도시 ${fresh.books.length}개 · 기기에 0개 저장`),
  ).toBeVisible()
  await d.getByRole('textbox').fill('새도시')
  await expect(d.locator('.guidebook-row')).toHaveCount(1)
  const cached = await page.evaluate(
    (key) => localStorage.getItem(key),
    cacheKey,
  )
  expect(JSON.parse(cached!).index.books).toHaveLength(fresh.books.length)
  await page.keyboard.press('Escape')
  d = await library(page)
  await expect(d.locator('.guidebook-row')).toHaveCount(1)
  expect(requests).toEqual([base + 'manifest.json'])
  await page.reload()
  await expect(page.locator('.guidebook-library')).toBeVisible()
  await context.setOffline(true)
  await page.keyboard.press('Escape')
  d = await library(page)
  await expect(
    d.locator('.guidebook-row').getByText('새도시', { exact: true }),
  ).toBeVisible()
  expect(requests).toEqual([base + 'manifest.json'])
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(raw)
  expect(
    await page.evaluate(() => localStorage.getItem('jdo-guidebooks-v1')),
  ).toBeNull()
})

test('library and city search share a pending check; changing search text sends no additional queries', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r)),
    requests: string[] = []
  await page.route(base + '**', async (r) => {
    requests.push(r.request().url())
    await gate
    await r.fulfill({ json: fresh })
  })
  await boot(page)
  await library(page)
  await expect.poll(() => requests.length).toBe(1)
  await page.keyboard.press('Escape')
  await page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  const search = page.getByRole('textbox', { name: '여행지와 장소 검색' })
  await search.fill('새도시')
  release()
  await expect(
    page.getByRole('button', { name: '새도시 가이드 받기', exact: true }),
  ).toBeVisible()
  for (const value of ['새', '새도', '새도시']) await search.fill(value)
  expect(requests).toEqual([base + 'manifest.json'])
})

test('failed automatic check preserves cache and filter, does not mark it fresh, and manual retry succeeds', async ({
  page,
}) => {
  const saved = {
    schemaVersion: 1,
    index: bundled,
    checkedAt: '2026-11-01T00:00:00Z',
  }
  let count = 0
  await page.route(base + 'manifest.json', (r) =>
    ++count === 1 ? r.abort() : r.fulfill({ json: fresh }),
  )
  await boot(page, saved)
  const d = await library(page)
  await d.getByRole('textbox').fill('새도시')
  await expect(d.getByText(/목록을 확인하지 못했어요/)).toBeVisible()
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).checkedAt,
      cacheKey,
    ),
  ).toBe(saved.checkedAt)
  await d.getByRole('button', { name: '목록 새로고침', exact: true }).click()
  await expect(
    d.locator('.guidebook-row').getByText('새도시', { exact: true }),
  ).toBeVisible()
  expect(await d.getByRole('textbox').inputValue()).toBe('새도시')
  expect(count).toBe(2)
})

for (const mode of ['older', 'invalid'] as const)
  test(`${mode} remote list cannot replace a previously verified newer list`, async ({
    page,
  }) => {
    const saved = {
      schemaVersion: 1,
      index: fresh,
      checkedAt: '2026-11-01T00:00:00Z',
    }
    await page.route(base + 'manifest.json', (r) =>
      r.fulfill({
        json:
          mode === 'older'
            ? bundled
            : {
                ...fresh,
                books: [{ ...fresh.books[0], file: '../../private' }],
              },
      }),
    )
    await boot(page, saved)
    const d = await library(page)
    await expect(
      d.getByText(
        mode === 'older' ? /이전 목록이 응답/ : /목록을 확인하지 못했어요/,
      ),
    ).toBeVisible()
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        cacheKey,
      ),
    ).toEqual(saved)
    await d.getByRole('textbox').fill('새도시')
    await expect(d.locator('.guidebook-row')).toHaveCount(1)
    expect(
      await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
    ).toBe(raw)
  })

test('public-index quota failure still shows new cities and preserves personal data without claiming durable cache', async ({
  page,
}) => {
  await page.route(base + 'manifest.json', (r) => r.fulfill({ json: fresh }))
  await boot(page, undefined, true)
  const d = await library(page)
  await expect(d.getByText(/기기에 보관하지 못했어요/)).toBeVisible()
  await d.getByRole('textbox').fill('새도시')
  await expect(d.locator('.guidebook-row')).toHaveCount(1)
  expect(
    await page.evaluate((key) => localStorage.getItem(key), cacheKey),
  ).toBeNull()
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(raw)
})

test('corrupt or far-future cached timestamps do not prevent a real list check', async ({
  page,
}) => {
  let count = 0
  await page.route(base + 'manifest.json', (r) => {
    count++
    return r.fulfill({ json: fresh })
  })
  await boot(page, {
    schemaVersion: 1,
    index: bundled,
    checkedAt: '2099-01-01T00:00:00Z',
  })
  const d = await library(page)
  await expect(
    d.getByText(`받을 수 있는 도시 ${fresh.books.length}개 · 기기에 0개 저장`),
  ).toBeVisible()
  expect(count).toBe(1)
})
