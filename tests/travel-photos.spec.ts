import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { createHash } from 'node:crypto'
import { tripSchema, type Trip } from '../src/travel-model'
import { canonicalSnapshot, emptySyncSnapshot } from '../src/sync-model'
import { mergeSyncSnapshots } from '../src/sync-merge'
import { tripCover, selectTripCover } from '../src/trip-photos'
const red = await sharp({
  create: { width: 32, height: 24, channels: 3, background: '#e75d50' },
})
  .png()
  .toBuffer()
const blue = await sharp({
  create: { width: 32, height: 24, channels: 3, background: '#4c86df' },
})
  .png()
  .toBuffer()
const photo = (name = '여행 풍경.png', buffer = red) => ({
  name,
  mimeType: 'image/png',
  buffer,
})
const fixture = (id = 'photo-trip'): Trip =>
  tripSchema.parse({
    id,
    title: id === 'photo-trip' ? '내 괌 여행' : '또 다른 괌 여행',
    cityId: 'personal-' + id,
    startDate: '2026-12-22',
    endDate: '2026-12-23',
    travelers: 1,
    destinations: [
      {
        id: 'guam-own',
        name: '괌',
        country: '미국령 괌',
        timeZone: 'Pacific/Guam',
      },
    ],
    days: [
      [
        {
          id: 'beach',
          placeId: 'custom-beach',
          time: '',
          note: '내 일정 메모',
          custom: {
            name: '내 해변',
            kind: '관광',
            address: '내가 저장한 주소',
            destinationId: 'guam-own',
            coordinates: { lat: 13.5, lng: 144.8 },
            link: '',
          },
        },
      ],
      [],
    ],
    attachments: [],
    reservations: [],
    expenses: [],
    checklist: [],
  })
async function boot(page: Page, trips = [fixture()]) {
  await page.clock.setFixedTime(new Date('2026-11-11T03:00:00Z'))
  await page.addInitScript(
    ({ trips }) => {
      if (!sessionStorage.getItem('photo-seeded')) {
        localStorage.setItem(
          'jido-travel-v1',
          JSON.stringify({
            version: 1,
            savedCities: [],
            savedPlaces: [],
            trips,
          }),
        )
        sessionStorage.setItem('photo-seeded', 'yes')
      }
    },
    { trips },
  )
  await page.route('**/*', (r) =>
    r.request().url().startsWith('http://127.0.0.1:')
      ? r.continue()
      : r.abort(),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'J★Do 홈' }).waitFor()
}
const saved = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips as Trip[],
  )
const nav = (page: Page, name: string) =>
  page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
async function gallery(page: Page, stop = false) {
  if (stop) {
    await nav(page, '내 여행')
    await page
      .getByRole('button', { name: '내 해변 사진 추가·관리', exact: true })
      .click()
  } else {
    await nav(page, '홈')
    await page.getByRole('button', { name: '여행 사진', exact: true }).click()
  }
  return page.getByRole('dialog')
}
async function add(page: Page, files = [photo()], stop = false) {
  const d = await gallery(page, stop)
  await d.getByLabel('첨부할 자료 파일').setInputFiles(files)
  await expect(d.locator('.photo-thumbnail')).toHaveCount(files.length)
  return d
}
async function disk(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('jido-attachments-v1', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('files')
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const r = db.transaction('files').objectStore('files').getAllKeys()
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
    db.close()
    return keys
  })
}
async function fail(page: Page, value: boolean) {
  await page.evaluate((value) => {
    const w = window as any
    if (!w.originalPhotoSet) w.originalPhotoSet = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, text) {
      if (key === 'jido-travel-v1' && value)
        throw new DOMException('full', 'QuotaExceededError')
      return w.originalPhotoSet.call(this, key, text)
    }
  }, value)
}
test('trip photos select a cover, survive restart and remain separate for two trips to the same city', async ({
  page,
}) => {
  await boot(page, [
    fixture(),
    {
      ...fixture('second-trip'),
      startDate: '2027-01-22',
      endDate: '2027-01-23',
    },
  ])
  const d = await add(page, [photo(), photo('푸른 풍경.png', blue)])
  await d
    .getByRole('button', {
      name: '푸른 풍경.png 대표 사진으로 사용',
      exact: true,
    })
    .click()
  await expect(
    d.getByRole('button', {
      name: '푸른 풍경.png 대표 사진으로 사용',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  const before = await saved(page)
  expect(tripCover(before[0])?.name).toBe('푸른 풍경.png')
  expect(before[1].attachments).toEqual([])
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(
    page.getByRole('img', { name: '내 괌 여행 내 사진', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('img', { name: '내 괌 여행 내 사진', exact: true }),
  ).toBeVisible()
  await nav(page, '내 여행')
  await expect(page.locator('[data-trip-id="photo-trip"] img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(
    page.locator('[data-trip-id="second-trip"] img'),
  ).not.toHaveAttribute('src', /^blob:/)
})
test('place photo is visible on the reading card and during travel without altering the untimed schedule', async ({
  page,
}) => {
  await boot(page)
  const before = (await saved(page))[0].days
  const d = await add(
    page,
    [photo('해변 첫 사진.png'), photo('해변 두번째.png', blue)],
    true,
  )
  await d
    .getByRole('button', { name: '해변 두번째.png 대표 사진으로 사용' })
    .click()
  const trip = (await saved(page))[0]
  expect(trip.days[0][0].photoId).toBe(trip.attachments?.[1].id)
  expect({ ...trip.days[0][0], photoId: undefined }).toEqual({
    ...before[0][0],
    photoId: undefined,
  })
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.stop-condensed .stop-place > img')).toBeVisible()
  await page.getByRole('tab', { name: '여행 중', exact: true }).click()
  await expect(page.locator('.field-primary-photo')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(
    page
      .getByRole('region', { name: '장소 사진', exact: true })
      .getByRole('button', { name: '사진 추가', exact: true }),
  ).toBeVisible()
})
test('full ZIP contains exact trip/place photo bytes and restores the chosen covers with new file identifiers', async ({
  page,
}) => {
  await boot(page)
  let d = await add(page, [photo(), photo('대표.png', blue)])
  await d
    .getByRole('button', { name: '대표.png 대표 사진으로 사용', exact: true })
    .click()
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  d = await add(page, [photo('장소.png')], true)
  await d
    .getByRole('button', { name: '장소.png 대표 사진으로 사용', exact: true })
    .click()
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  const original = (await saved(page))[0]
  await nav(page, '설정')
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  d = page.getByRole('dialog')
  const pending = page.waitForEvent('download')
  await d.getByRole('button', { name: '전체 백업 저장', exact: true }).click()
  const archive = readFileSync((await (await pending).path())!)
  const entries = unzipSync(archive),
    manifest = JSON.parse(strFromU8(entries['manifest.json']))
  expect(manifest.trips[0].attachments.map((f: any) => f.name)).toEqual([
    '대표.png',
    '여행 풍경.png',
    '장소.png',
  ])
  for (const file of manifest.files)
    expect(
      createHash('sha256')
        .update(entries['files/' + file.id])
        .digest('hex'),
    ).toBe(file.sha256)
  expect(Buffer.from(entries['files/' + original.attachments![0].id])).toEqual(
    blue,
  )
  await d.getByLabel('사진·자료 포함 백업 파일').setInputFiles({
    name: '사진백업.zip',
    mimeType: 'application/zip',
    buffer: archive,
  })
  await d
    .getByRole('button', { name: '사진·자료까지 복원', exact: true })
    .click()
  await expect.poll(async () => (await saved(page)).length).toBe(2)
  const restored = (await saved(page))[1]
  expect(tripCover(restored)?.name).toBe('대표.png')
  expect(restored.id).not.toBe(original.id)
  expect(restored.attachments?.map((f) => f.id)).not.toEqual(
    original.attachments?.map((f) => f.id),
  )
  expect(restored.days[0][0].photoId).toBe(
    restored.attachments?.find((f) => f.name === '장소.png')?.id,
  )
})
test('photo save failure cleans uncommitted bytes, keeps the original cover and permits a single retry', async ({
  page,
}) => {
  await boot(page)
  const d = await add(page)
  const before = await saved(page)
  await fail(page, true)
  await d
    .getByLabel('첨부할 자료 파일')
    .setInputFiles(photo('저장 실패.png', blue))
  await expect(d.locator('.attachment-error')).toBeVisible()
  expect(await saved(page)).toEqual(before)
  await expect.poll(async () => (await disk(page)).length).toBe(1)
  await fail(page, false)
  await d
    .getByLabel('첨부할 자료 파일')
    .setInputFiles(photo('저장 실패.png', blue))
  await expect(d.locator('.photo-thumbnail')).toHaveCount(2)
  expect((await saved(page))[0].attachments).toHaveLength(2)
})
test('corrupt pictures are rejected and no orphan bytes or metadata remain', async ({
  page,
}) => {
  await boot(page)
  const d = await gallery(page)
  await d
    .getByLabel('첨부할 자료 파일')
    .setInputFiles(photo('손상.png', Buffer.from('not an image')))
  await expect(d.locator('.attachment-error')).toContainText(
    '사진을 열 수 없어요',
  )
  expect((await saved(page))[0].attachments).toEqual([])
  expect(await disk(page)).toEqual([])
})
test('deletion waits for saved metadata, cancellation keeps photos and a removed cover falls back to the next photo', async ({
  page,
}) => {
  await boot(page)
  const d = await add(page, [photo(), photo('남길 사진.png', blue)])
  await d
    .getByRole('button', { name: '여행 풍경.png 첨부 삭제', exact: true })
    .click()
  await d.getByRole('button', { name: '취소', exact: true }).click()
  expect((await saved(page))[0].attachments).toHaveLength(2)
  await d
    .getByRole('button', { name: '여행 풍경.png 첨부 삭제', exact: true })
    .click()
  await fail(page, true)
  await d.getByRole('button', { name: '첨부 삭제', exact: true }).click()
  await expect(d.locator('.attachment-error')).toBeVisible()
  expect((await saved(page))[0].attachments).toHaveLength(2)
  expect(await disk(page)).toHaveLength(2)
  await fail(page, false)
  await d.getByRole('button', { name: '첨부 삭제', exact: true }).click()
  await expect.poll(async () => (await disk(page)).length).toBe(1)
  expect(tripCover((await saved(page))[0])?.name).toBe('남길 사진.png')
})
test('closing a gallery during decoding prevents late writes and cleans the imported file', async ({
  page,
}) => {
  await boot(page)
  const d = await gallery(page)
  await page.evaluate(() => {
    const w = window as any,
      original = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = function () {
      return new Promise<void>((resolve, reject) => {
        w.finishPhotoDecode = () => original.call(this).then(resolve, reject)
      })
    }
  })
  await d.getByLabel('첨부할 자료 파일').setInputFiles(photo())
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).finishPhotoDecode))
    .toBe('function')
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await page.evaluate(() => (window as any).finishPhotoDecode())
  await expect.poll(async () => (await disk(page)).length).toBe(0)
  expect((await saved(page))[0].attachments).toEqual([])
})
test('trip cover order survives sync canonicalization and independent itinerary changes', async () => {
  const base = emptySyncSnapshot(),
    trip = fixture()
  const files = [
    'c596ff3a-50fd-452b-b57c-308299464acf',
    '2879170b-0780-4ab9-b0b0-0b9979885736',
  ].map((id, index) => ({
    id,
    name: `${index}.png`,
    mimeType: 'image/png' as const,
    size: 10,
    storage: 'browser' as const,
    createdAt: '2026-11-11T00:00:00Z',
  }))
  trip.attachments = files
  base.store.trips = [trip]
  const left = structuredClone(base),
    right = structuredClone(base)
  left.store.trips[0].attachments = selectTripCover(files, files[1].id)
  right.store.trips[0].days[0][0].note = '다른 기기 메모'
  const merged = mergeSyncSnapshots(
    base,
    canonicalSnapshot(left),
    canonicalSnapshot(right),
  )
  expect(merged.conflicts).toEqual([])
  expect(tripCover(merged.snapshot.store.trips[0])?.id).toBe(files[1].id)
  expect(merged.snapshot.store.trips[0].days[0][0].note).toBe('다른 기기 메모')
})
test('photo galleries and the selected trip cover fit a narrow screen with long names', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await boot(page)
  const d = await add(page, [
    photo('아주긴여행사진이름'.repeat(5) + '.png'),
    photo('두번째 사진.png', blue),
  ])
  await expect(d.locator('.photo-thumbnail')).toHaveCount(2)
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
    true,
  )
  for (const action of await d
    .locator('.photo-gallery .photo-cover-button,.photo-gallery .icon-button')
    .all()) {
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  await page.screenshot({ path: info.outputPath('photo-gallery-320.png') })
  await d.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.planner-cover-photo')).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath('photo-home-320.png') })
})

test('photo preview closes first with Escape and Android back, leaving the gallery open', async ({
  page,
}) => {
  await boot(page)
  const d = await add(page)
  await d
    .getByRole('button', { name: '여행 풍경.png 자료 열기', exact: true })
    .click()
  const preview = page.locator('dialog.attachment-preview')
  await expect(preview).toBeVisible()
  await expect(preview.locator('img')).toHaveAttribute('src', /^blob:/)
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()
  await expect(d).toBeVisible()
  await d
    .getByRole('button', { name: '여행 풍경.png 자료 열기', exact: true })
    .click()
  await expect(preview).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(preview).toBeHidden()
  await expect(d).toBeVisible()
  expect((await saved(page))[0].attachments).toHaveLength(1)
})
