import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { tripSchema } from '../src/travel-model'
import { getPlace } from '../src/catalog'
const trip = () =>
  tripSchema.parse({
    id: 'cleanup-trip',
    title: '괌 여행',
    cityId: 'guam',
    startDate: '2026-12-22',
    endDate: '2026-12-23',
    travelers: 1,
    days: [
      [
        {
          id: 'beach',
          placeId: 'guam-tumon-beach',
          time: '',
          note: '남겨둘 개인 메모',
        },
      ],
      [],
    ],
    reservations: [
      {
        id: 'hotel',
        title: '내 호텔',
        kind: '숙소',
        date: '2026-12-22',
        endDate: '2026-12-23',
        time: '15:00',
        reference: 'SYNTHETIC-ONLY',
        address: '',
        link: '',
        note: '',
        status: 'confirmed',
      },
    ],
    expenses: [],
    attachments: [],
    checklist: [],
  })
const envelope = () => ({
  version: 1,
  savedCities: ['guam'],
  savedPlaces: ['guam-tumon-beach'],
  trips: [trip()],
})
const nav = (page: Page, name: string) =>
  page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
async function boot(page: Page, session?: unknown) {
  const stock: string[] = []
  await page.clock.setFixedTime(new Date('2026-11-11T03:00:00Z'))
  await page.addInitScript(
    ({ store, session }) => {
      if (!sessionStorage.getItem('cleanup-seeded')) {
        localStorage.setItem('jido-travel-v1', JSON.stringify(store))
        if (session)
          localStorage.setItem('jido-last-screen-v1', JSON.stringify(session))
        sessionStorage.setItem('cleanup-seeded', 'yes')
      }
    },
    { store: envelope(), session },
  )
  page.on('request', (request) => {
    if (
      /\/images\/.*\.(?:jpe?g|webp)|\/(?:photo-sources|photo-research|guide-research|guidebooks\/manifest)/.test(
        request.url(),
      )
    )
      stock.push(request.url())
  })
  await page.route('**/*', (r) =>
    r.request().url().startsWith('http://127.0.0.1:')
      ? r.continue()
      : r.abort(),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'J★Do 홈' }).waitFor()
  return stock
}
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('jido-travel-v1')!))
test('five menus and preparation contain no photo-credit or guide controls and do not change personal records', async ({
  page,
}, info) => {
  const stock = await boot(page),
    before = await saved(page)
  for (const name of ['홈', '내 여행', '예약', '경비', '설정']) {
    await nav(page, name)
    await expect(
      page.getByRole('button', {
        name: /사진 출처|가이드북|여행 가이드|가볼 만한 곳|새 정보 확인/,
      }),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    if (name === '설정') {
      await expect(
        page.getByRole('button', { name: '여행 알림 설정', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: '여행 백업·공유', exact: true }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: '개인정보 처리 안내' }),
      ).toBeVisible()
      await page.screenshot({ path: info.outputPath('clean-settings.png') })
    }
  }
  await nav(page, '내 여행')
  await page.getByRole('tab', { name: '여행 준비', exact: true }).click()
  for (const name of ['요약', '예약', '준비물', '자료']) {
    await page
      .getByRole('group', { name: '준비 관리', exact: true })
      .getByRole('button', { name, exact: true })
      .click()
    await expect(page.locator('main')).not.toContainText(
      /가이드북|가이드 받기|추천 코스|사진 출처/,
    )
  }
  expect(await saved(page)).toEqual(before)
  expect(stock).toEqual([])
})
test('an old photo-credits session returns to settings without reopening a removed or blank dialog', async ({
  page,
}) => {
  const session = {
    version: 1,
    page: 'settings',
    tripLibrary: false,
    activeTripId: 'cleanup-trip',
    day: 0,
    query: '이전 검색',
    region: '전체',
    category: '관광',
    exploreCity: 'guam',
    exploreTab: 'places',
    placeLimit: 48,
    scroll: 500,
    modalScroll: [200],
    detailCount: 999,
    openDetails: [1, 2],
    dialog: { type: 'credits' },
  }
  await boot(page, session)
  await expect(
    page.getByRole('heading', { name: '설정', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await saved(page)).toEqual(envelope())
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '설정', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('legacy guide-origin schedules retain identity and notes while displaying an icon instead of a stock photo', async ({
  page,
}) => {
  const stock = await boot(page),
    original = await saved(page)
  expect(getPlace('guam-tumon-beach')?.image).toBeTruthy()
  await nav(page, '내 여행')
  const card = page.locator('[data-stop-id="beach"]')
  await expect(card.locator('.stop-place > img')).toHaveCount(0)
  await expect(
    card.getByRole('button', { name: '투몬 비치 사진 추가·관리', exact: true }),
  ).toBeVisible()
  await card.getByRole('button', { name: /일정 상세 펼치기/ }).click()
  await expect(
    card.getByRole('img', { name: '투몬 비치 사진 없음', exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: '여행 중', exact: true }).click()
  await expect(page.locator('img.field-primary-photo')).toHaveCount(0)
  await expect(
    page.getByRole('img', { name: '투몬 비치 사진 없음', exact: true }),
  ).toBeVisible()
  expect(await saved(page)).toEqual(original)
  expect(stock).toEqual([])
})
test('old personal city and place photos still appear after stock imagery and its credits are removed', async ({
  page,
}) => {
  const png = await sharp({
    create: { width: 24, height: 24, channels: 3, background: '#1b8c83' },
  })
    .png()
    .toBuffer()
  const files = [randomUUID(), randomUUID()].map((id, index) => ({
    id,
    name: `기존 내 사진${index}.png`,
    mimeType: 'image/png',
    size: png.length,
    createdAt: '2026-11-11T00:00:00Z',
    storage: 'browser',
  }))
  await page.addInitScript(
    async ({ files, bytes }) => {
      localStorage.setItem(
        'jido-personal-photos-v1',
        JSON.stringify({
          'city:guam': files[0],
          'place:guam-tumon-beach': files[1],
        }),
      )
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('jido-attachments-v1', 1)
        r.onupgradeneeded = () => r.result.createObjectStore('files')
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite')
        for (const f of files)
          tx.objectStore('files').put(
            new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
            f.id,
          )
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      db.close()
    },
    { files, bytes: Array.from(png) },
  )
  const stock = await boot(page)
  await expect(page.locator('.planner-cover-photo')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await nav(page, '내 여행')
  await expect(page.locator('.trip-plan-cover')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(page.locator('.stop-place > img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await page.getByRole('tab', { name: '여행 중', exact: true }).click()
  await expect(page.locator('img.field-primary-photo')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  expect(
    await page.evaluate(() =>
      Object.keys(JSON.parse(localStorage.getItem('jido-personal-photos-v1')!)),
    ),
  ).toEqual(['city:guam', 'place:guam-tumon-beach'])
  expect(stock).toEqual([])
})
test('the client package omits stock photos and guide research while retaining the font and data licenses', async () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    )
  const paths = walk('dist')
  expect(
    paths.filter((p) => /\/images\/.*\.(?:jpe?g|webp|png)$/.test(p)),
  ).toEqual([])
  expect(
    paths.filter((p) =>
      /(?:photo-sources|photo-research|guide-research|guide-blog-research|place-blog-research)\.json/.test(
        p,
      ),
    ),
  ).toEqual([])
  expect(readFileSync('dist/licenses/Pretendard-OFL.txt', 'utf8')).toContain(
    'SIL OPEN FONT LICENSE',
  )
  expect(readFileSync('dist/licenses/travel-data.txt', 'utf8')).toContain(
    'OpenStreetMap contributors',
  )
  expect(
    readFileSync('dist/fonts/PretendardVariable.woff2').length,
  ).toBeGreaterThan(1000000)
})
