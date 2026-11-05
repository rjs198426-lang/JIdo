import { test, expect, type Page } from '@playwright/test'
import { zipSync, strToU8 } from 'fflate'
import {
  libraryPlaces,
  savePersonalPlace,
  removeLibraryPlace,
  mergePlaceLibraries,
  type PersonalPlace,
} from '../src/personal-place-library'
import {
  fullManifest,
  inspectFullBackup,
  commitFullRestore,
} from '../src/full-backup'
import { isValidStore } from '../src/store'
import { tripSchema } from '../src/travel-model'
import { openTrips } from './navigation'

const destination = {
  id: 'guam',
  name: '괌',
  country: '미국령 괌',
  guideCityId: 'guam',
}
const pic = {
  name: '퍼시픽 아일랜드 클럽 괌',
  kind: '숙소' as const,
  address: '210 Pale San Vitores Rd, Tumon',
  link: '',
  destinationId: 'guam',
  coordinates: { lat: 13.5, lng: 144.8 },
  googlePlaceId: 'fixture-pic',
}
const trip = tripSchema.parse({
  id: 'pic-trip',
  title: 'PIC 괌 여행',
  cityId: 'guam',
  startDate: '2026-12-22',
  endDate: '2026-12-23',
  travelers: 1,
  destinations: [destination],
  dayDestinationIds: ['guam', 'guam'],
  days: [
    [
      {
        id: 'pic-stop',
        placeId: 'custom-pic',
        time: '',
        note: '복제하지 않을 개인 메모',
        custom: pic,
      },
    ],
    [],
  ],
})
const own: PersonalPlace = {
  id: '11111111-1111-4111-8111-111111111111',
  destination,
  custom: pic,
  description: '가족 수영장이 있는 숙소',
  sourceKeys: [],
}
const initial = {
  version: 1 as const,
  savedCities: [],
  savedPlaces: ['guam-tumon-beach'],
  trips: [trip],
}

test('개인 장소 저장·분류 변경·일정 유래 중복 제거·삭제가 일정 원문을 바꾸지 않음', () => {
  const before = structuredClone(trip)
  const derived = libraryPlaces([trip])[0]
  let library = savePersonalPlace(undefined, own, derived)
  expect(
    savePersonalPlace(library, {
      ...own,
      id: '22222222-2222-4222-8222-222222222222',
    }).entries[0].id,
  ).toBe(own.id)
  expect(libraryPlaces([trip], library)).toHaveLength(1)
  expect(libraryPlaces([], library)[0].custom.kind).toBe('숙소')
  library = savePersonalPlace(
    library,
    { ...own, custom: { ...pic, kind: '카페' } },
    libraryPlaces([trip], library)[0],
  )
  expect(libraryPlaces([trip], library)).toHaveLength(1)
  expect(libraryPlaces([trip], library)[0].custom.kind).toBe('카페')
  const deleted = removeLibraryPlace(library, libraryPlaces([trip], library)[0])
  expect(libraryPlaces([trip], deleted)).toEqual([])
  expect(trip).toEqual(before)
  expect(isValidStore({ ...initial, placeLibrary: deleted })).toBe(true)
})

test('이전 백업·개인 장소만 있는 전체 백업을 읽고 기존 장소 우선으로 합치며 저장 실패는 전파', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  try {
    const library = savePersonalPlace(undefined, own)
    const manifest = { ...fullManifest([], library), files: [] }
    const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
    const preview = await inspectFullBackup(
      new File([new Uint8Array(zip)], 'places.zip'),
    )
    expect(preview?.manifest.placeLibrary?.entries[0]).toEqual(own)
    expect(preview?.manifest.version).toBe(2)
    const merged = commitFullRestore(
      initial,
      [],
      {},
      () => {},
      preview!.manifest.placeLibrary,
    )
    expect(merged.placeLibrary?.entries).toHaveLength(1)
    expect(
      mergePlaceLibraries(merged.placeLibrary, library)?.entries,
    ).toHaveLength(1)
    expect(() =>
      commitFullRestore(
        initial,
        [],
        {},
        () => {
          throw new Error('저장 실패')
        },
        library,
      ),
    ).toThrow('저장 실패')
    expect(fullManifest([trip]).placeLibrary).toBeUndefined()
    expect(fullManifest([trip]).version).toBe(1)
    const invalid = {
      ...manifest,
      placeLibrary: {
        entries: [{ ...own, custom: { ...pic, destinationId: 'wrong' } }],
        hidden: [],
      },
    }
    await expect(
      inspectFullBackup(
        new File(
          [
            new Uint8Array(
              zipSync({ 'manifest.json': strToU8(JSON.stringify(invalid)) }),
            ),
          ],
          'bad.zip',
        ),
      ),
    ).rejects.toThrow()
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

async function boot(page: Page, withTrip = false) {
  await page.addInitScript(
    ({ store }) => {
      if (!sessionStorage.getItem('personal-places-seed')) {
        sessionStorage.setItem('personal-places-seed', 'yes')
        localStorage.setItem('jido-travel-v1', JSON.stringify(store))
      }
      localStorage.setItem('jdo-content-auto-v1', 'false')
    },
    { store: { ...initial, trips: withTrip ? [trip] : [] } },
  )
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('guam')
}
const read = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('jido-travel-v1')!))
async function add(page: Page, name = 'PIC 직접 저장') {
  await page
    .locator('.place-library-toolbar')
    .getByRole('button', { name: '장소 추가', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('장소 이름', { exact: true }).fill(name)
  await dialog.getByLabel('장소 분류').selectOption('숙소')
  await dialog.getByLabel('장소 소개').fill('아이와 함께 머물 숙소')
  return dialog
}

test('여행 없이 숙소를 추가하고 30곳 도시 수·숙소 필터·침대 아이콘과 재실행 저장을 일치', async ({
  page,
}) => {
  await boot(page)
  const dialog = await add(page)
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  const card = page.getByRole('article', {
    name: 'PIC 직접 저장 숙소',
    exact: true,
  })
  await expect(card).toBeVisible()
  await expect(card.locator('svg.lucide-bed-double')).toHaveCount(1)
  await expect(
    page.getByLabel('가볼 만한 곳의 도시').locator('option:checked'),
  ).toContainText('30곳')
  await page
    .locator('.category-row')
    .getByRole('button', { name: '숙소', exact: true })
    .click()
  await expect(card).toBeVisible()
  expect((await read(page)).trips).toEqual([])
  await page.reload()
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: '장소 편집', exact: true }).click()
  await card.getByRole('button', { name: /장소 편집/ }).click()
  await page.getByLabel('장소 분류').selectOption('카페')
  await page
    .getByRole('button', { name: '장소 수정 저장', exact: true })
    .click()
  await expect(card).toHaveCount(0)
  await page
    .locator('.category-row')
    .getByRole('button', { name: '카페', exact: true })
    .click()
  await expect(
    page.getByRole('article', { name: 'PIC 직접 저장 카페', exact: true }),
  ).toBeVisible()
})

test('기존 PIC가 숙소로 보이며 목록에 독립 저장 후 여행을 지워도 남고 원래 메모는 복제하지 않음', async ({
  page,
}) => {
  await boot(page, true)
  const before = (await read(page)).trips
  const card = page.getByRole('article', {
    name: `${pic.name} 숙소`,
    exact: true,
  })
  await expect(card.locator('svg.lucide-bed-double')).toHaveCount(1)
  await page
    .locator('.category-row')
    .getByRole('button', { name: '숙소', exact: true })
    .click()
  await expect(card).toBeVisible()
  await card
    .getByRole('button', { name: `${pic.name} 자세히 보기`, exact: true })
    .click()
  await page
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await page
    .getByRole('button', { name: '장소 수정 저장', exact: true })
    .click()
  const store = await read(page)
  expect(store.trips).toEqual(before)
  expect(store.placeLibrary.entries[0].description).toBe('')
  expect(JSON.stringify(store.placeLibrary)).not.toContain(
    '복제하지 않을 개인 메모',
  )
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    store.trips = []
    localStorage.setItem('jido-travel-v1', JSON.stringify(store))
  })
  await page.reload()
  await expect(card).toBeVisible()
  await expect(
    page.getByLabel('가볼 만한 곳의 도시').locator('option:checked'),
  ).toContainText('30곳')
})

test('PIC 약칭으로 기존 숙소를 먼저 찾고 외부 조회 없이 독립 저장하며 중복하지 않음', async ({ page }) => {
  await boot(page, true)
  let external = 0
  page.on('request', request => { if (/photon\.komoot|places\.googleapis|maps\.googleapis/.test(request.url())) external++ })
  const dialog = await add(page, 'PIC')
  await dialog.getByRole('button', { name: '찾기', exact: true }).click()
  await dialog.locator('.local-place-results').getByRole('button', { name: `${pic.name} · 숙소`, exact: true }).click()
  await expect(dialog.getByLabel('장소 분류')).toHaveValue('숙소')
  await dialog.getByRole('button', { name: '장소 목록에 저장', exact: true }).click()
  expect(external).toBe(0)
  expect((await read(page)).placeLibrary.entries).toHaveLength(1)
  await expect(page.getByRole('article', { name: `${pic.name} 숙소`, exact: true })).toHaveCount(1)
  await expect(page.getByLabel('가볼 만한 곳의 도시').locator('option:checked')).toContainText('30곳')
})

test('삭제한 직접 장소가 일정에서 재등장하지 않고 목록 삭제·재시작·추천 삭제는 원래 일정을 보존', async ({
  page,
}) => {
  await boot(page, true)
  const before = (await read(page)).trips
  await page.getByRole('button', { name: '장소 편집', exact: true }).click()
  await page
    .getByRole('button', { name: `${pic.name} 목록에서 삭제`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '목록에서 삭제', exact: true })
    .click()
  await expect(
    page.getByRole('article', { name: `${pic.name} 숙소`, exact: true }),
  ).toHaveCount(0)
  expect((await read(page)).trips).toEqual(before)
  await page.reload()
  await expect(
    page.getByRole('article', { name: `${pic.name} 숙소`, exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: '장소 편집', exact: true }).click()
  await page
    .getByRole('button', { name: '투몬 비치 목록에서 삭제', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '목록에서 삭제', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '투몬 비치 자세히 보기', exact: true }),
  ).toHaveCount(0)
  expect((await read(page)).savedPlaces).toContain('guam-tumon-beach')
  await page.getByRole('button', { name: '실행 취소', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '투몬 비치 자세히 보기', exact: true }),
  ).toBeVisible()
  await openTrips(page)
  await expect(page.locator('.stop-card')).toContainText(pic.name)
  expect((await read(page)).trips).toEqual(before)
})

test('저장 실패는 입력과 원본을 유지하고 재시도 한 번만 저장하며 열린 장소 초안을 재실행 복원', async ({
  page,
}) => {
  await boot(page)
  let dialog = await add(page, '저장 실패 호텔')
  await page.reload()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('장소 이름', { exact: true })).toHaveValue(
    '저장 실패 호텔',
  )
  await expect(dialog.getByLabel('장소 분류')).toHaveValue('숙소')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as any).failPlaces = true
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-travel-v1' && (window as any).failPlaces)
        throw new DOMException('full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('alert')).toContainText('저장하지 못했어요')
  expect((await read(page)).placeLibrary).toBeUndefined()
  await page.evaluate(() => {
    ;(window as any).failPlaces = false
  })
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  expect((await read(page)).placeLibrary.entries).toHaveLength(1)
})

test('지도 검색 결과를 골라도 직접 고른 숙소 분류를 유지하고 이름 변경 시 이전 좌표·주소·ID를 제거', async ({
  page,
}) => {
  await boot(page)
  const dialog = await add(page, 'PIC')
  await page.route('https://photon.komoot.io/**', (route) =>
    route.fulfill({
      json: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [144.8, 13.5] },
            properties: {
              name: 'PIC Guam',
              osm_type: 'N',
              osm_id: 123,
              osm_key: 'amenity',
              osm_value: 'restaurant',
              country: 'Guam',
              city: 'Tumon',
            },
          },
        ],
      },
    }),
  )
  await dialog.getByRole('button', { name: '찾기', exact: true }).click()
  await dialog
    .locator('.google-place-results button')
    .filter({ hasText: 'PIC Guam' })
    .first()
    .click()
  await expect(dialog.getByLabel('장소 분류')).toHaveValue('숙소')
  await dialog.getByLabel('장소 이름', { exact: true }).fill('내 PIC 숙소')
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  const saved = (await read(page)).placeLibrary.entries[0].custom
  expect(saved).toMatchObject({
    name: '내 PIC 숙소',
    kind: '숙소',
    address: '',
    link: '',
  })
  expect(saved.coordinates).toBeUndefined()
  expect(saved.osmPlaceId).toBeUndefined()
})

test('320~1440px에서 직접 등록 카드·편집 버튼이 겹치지 않고 가이드·일정 담기에서도 숙소로 사용', async ({
  page,
}, info) => {
  await boot(page, true)
  const dialog = await add(page, 'PIC 가족 숙소 아주 긴 장소 이름 확인')
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  const card = page.getByRole('article', {
    name: 'PIC 가족 숙소 아주 긴 장소 이름 확인 숙소',
    exact: true,
  })
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 851 })
    await page.getByRole('button', { name: '장소 편집', exact: true }).click()
    const controls = card.locator('.place-library-card-actions button')
    for (const button of await controls.all()) {
      await button.scrollIntoViewIfNeeded()
      expect(
        await button.evaluate((element) => {
          const r = element.getBoundingClientRect()
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          )
          return (
            r.width >= 43.5 &&
            r.height >= 43.5 &&
            !!hit &&
            (element === hit || element.contains(hit))
          )
        }),
      ).toBe(true)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true)
    if (width === 393)
      await page.screenshot({
        path: `/workspace/jido-review-evidence-20261104/personal-place-078-${info.project.name || 'mobile'}.png`,
      })
    await page.getByRole('button', { name: '편집 완료', exact: true }).click()
  }
  await page.setViewportSize({ width: 393, height: 851 })
  await page.getByRole('tab', { name: /여행 도시/ }).click()
  await page
    .getByRole('button', { name: '괌 여행지 자세히 보기', exact: true })
    .click()
  await page
    .getByRole('tablist', { name: '도시 가이드', exact: true })
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  await page
    .getByRole('group', { name: '가볼 만한 곳 분류' })
    .getByRole('button', { name: '숙소', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByRole('article', {
      name: 'PIC 가족 숙소 아주 긴 장소 이름 확인 숙소',
      exact: true,
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await card.getByRole('button', { name: /일정에 추가$/ }).click()
  await page.getByLabel('어느 날에 갈까요?').selectOption('1')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '일정에 추가', exact: true })
    .click()
  const saved = (await read(page)).trips[0].days[1][0]
  expect(saved.custom.kind).toBe('숙소')
  expect(saved.time).toBe('')
  expect(saved.note).toBe('')
  expect(saved.photoId).toBeUndefined()
})

test('장소 삭제 저장 실패는 카드를 유지하고 실행 취소가 이후에 추가한 다른 장소를 덮어쓰지 않음', async ({
  page,
}) => {
  await boot(page)
  let dialog = await add(page, '첫 호텔')
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await page.getByRole('button', { name: '장소 편집', exact: true }).click()
  await page
    .getByRole('button', { name: '첫 호텔 목록에서 삭제', exact: true })
    .click()
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    ;(window as any).blockRemoval = true
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-travel-v1' && (window as any).blockRemoval)
        throw new DOMException('full', 'QuotaExceededError')
      set.call(this, key, value)
    }
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '목록에서 삭제', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect((await read(page)).placeLibrary.entries).toHaveLength(1)
  await page.evaluate(() => {
    ;(window as any).blockRemoval = false
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '목록에서 삭제', exact: true })
    .click()
  dialog = await add(page, '다음 호텔')
  await dialog
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await page.getByRole('button', { name: '실행 취소', exact: true }).click()
  expect(
    (await read(page)).placeLibrary.entries
      .map((entry: any) => entry.custom.name)
      .sort(),
  ).toEqual(['다음 호텔', '첫 호텔'])
})

test('손상된 개인 장소는 복구 원문을 보관하고 정상 장소와 기존 일정을 유지', async ({
  page,
}) => {
  const raw = JSON.stringify({
    ...initial,
    placeLibrary: {
      entries: [
        own,
        { ...own, id: 'bad', custom: { ...pic, kind: 'unknown' } },
      ],
      hidden: [],
    },
  })
  await page.addInitScript((raw) => {
    localStorage.setItem('jido-travel-v1', raw)
    localStorage.setItem('jdo-content-auto-v1', 'false')
  }, raw)
  await page.goto('/')
  await expect
    .poll(async () => Object.keys((await read(page)).placeLibrary || {}).length)
    .toBeGreaterThan(0)
  const saved = await read(page)
  expect(saved.placeLibrary.entries).toHaveLength(1)
  expect(saved.trips[0].days[0][0].note).toBe(trip.days[0][0].note)
  const records = await page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith('jido-travel-v1-recovery-v1:'))
      .map(([, text]) => JSON.parse(text)),
  )
  expect(
    records.some((record) => record.raw === raw && record.excludedPlaces === 1),
  ).toBe(true)
})
