import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
const base =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/guidebooks/'
const index = JSON.parse(readFileSync('guidebooks/manifest.json', 'utf8'))
const ids = [
  'book-nagasaki',
  'book-kumamoto',
  'book-kagoshima',
  'book-beppu',
  'book-yufuin',
  'book-matsuyama',
  'book-takamatsu',
  'book-tottori',
  'book-okayama',
  'book-kanazawa',
  'book-hakodate',
  'book-asahikawa',
  'book-ishigaki',
  'book-miyakojima',
  'book-dalat',
  'book-manila',
  'book-puertoprincesa',
  'book-hue',
  'book-langkawi',
  'book-penang',
  'book-halong',
  'book-pattaya',
  'book-krabi',
  'book-macau',
  'book-taichung',
]
test('researched city guide batches download one by one, render researched text offline, and preserve personal records', async ({
  page,
  context,
}) => {
  test.setTimeout(90000)
  const requests: string[] = []
  await page.route(base + '**', (r) => {
    requests.push(r.request().url())
    expect(r.request().method()).toBe('GET')
    expect(r.request().postData()).toBeNull()
    const name = r.request().url().slice(base.length)
    if (name === 'manifest.json') return r.fulfill({ json: index })
    const book = index.books.find((b: any) => b.file === name)
    return book
      ? r.fulfill({
          body: readFileSync('guidebooks/' + name, 'utf8'),
          contentType: 'application/json',
        })
      : r.abort()
  })
  await page.addInitScript(() => {
    localStorage.setItem('jdo-content-auto-v1', 'false')
    if (!sessionStorage.getItem('batch-seeded')) {
      sessionStorage.setItem('batch-seeded', 'yes')
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: ['kyoto'],
          savedPlaces: ['kiyomizu'],
          trips: [
            {
              id: 'private-book-check',
              title: '보존할 여행',
              cityId: 'kyoto',
              startDate: '2026-12-01',
              endDate: '2026-12-01',
              travelers: 1,
              days: [
                [
                  {
                    id: 'private-stop',
                    placeId: 'kiyomizu',
                    time: '',
                    note: '보존할 메모',
                  },
                ],
              ],
            },
          ],
        }),
      )
    }
  })
  await page.goto('/')
  await expect(page.locator('.travel-home')).toBeVisible()
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  async function library() {
    await page
      .locator('.desktop-nav:visible,.bottom-nav:visible')
      .getByRole('button', { name: '설정', exact: true })
      .click()
    await page.getByRole('button', { name: '가이드북', exact: true }).click()
    return page.getByRole('dialog')
  }
  let panel = await library()
  await panel.getByRole('button', { name: '목록 새로고침' }).click()
  await expect(panel.getByRole('status')).toBeVisible()
  for (const id of ids) {
    const book = index.books.find((b: any) => b.id === id)
    await panel.getByRole('textbox').fill(book.name)
    const row = panel.locator('.guidebook-row')
    await row.getByRole('button', { name: '불러오기', exact: true }).click()
    await expect(row.getByText('기기에 저장됨')).toBeVisible()
  }
  expect(requests).toEqual([
    base + 'manifest.json',
    ...ids.map((id) => base + index.books.find((b: any) => b.id === id).file),
  ])
  await page.reload()
  await expect(page.locator('.travel-home')).toBeVisible()
  await context.setOffline(true)
  for (const id of ids) {
    const book = index.books.find((b: any) => b.id === id)
    panel = await library()
    await panel.getByRole('textbox').fill(book.name)
    await panel.getByRole('button', { name: '열기', exact: true }).click()
    const detail = page.getByRole('dialog')
    await expect(detail).toHaveAccessibleName(book.name + ' 여행 가이드')
    const section = detail
      .locator('.guide-custom-content details')
      .filter({ hasText: '공항과 시내 이동' })
    await section.locator('summary').click()
    await expect(section.locator('p')).toContainText('공항')
    await detail.getByRole('tab', { name: '관광', exact: true }).click()
    await detail.getByRole('button', { name: '전체', exact: true }).click()
    await expect(detail.locator('.detail-place-list > div')).toHaveCount(
      book.placeCount,
    )
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})
