import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import { readFile } from 'node:fs/promises'
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import { openTrips, openWorkspace } from './navigation'
function fixture(): Trip {
  return tripSchema.parse({
    id: 'audit-fixes',
    title: '교토 자유여행',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    travelers: 1,
    members: [{ id: 'me', name: '나' }],
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '개인 예약 메모',
          reservationId: 'ticket',
        },
      ],
      [],
      [],
    ],
    reservations: [
      {
        id: 'ticket',
        title: '입장 예약',
        kind: '체험',
        date: '2026-11-01',
        time: '10:00',
        reference: 'PRIVATE-TICKET',
        address: '교토',
        link: '',
        note: '',
        status: 'confirmed',
      },
    ],
  })
}
async function seed(page: Page, trip = fixture()) {
  await page.goto('/')
  await page.evaluate(
    (trip) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      ),
    trip,
  )
  await page.reload()
  await openTrips(page)
}
async function tab(page: Page, name: string) {
  await openWorkspace(page, name)
}
async function backup(page: Page) {
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.locator('.legacy-backup > summary').click()
}
test('한글 검색은 실제 찾기 때만 알려진 영문 별칭으로 무료 재검색하고 선택 좌표를 보존', async ({
  page,
}) => {
  await seed(page)
  const queries: string[] = []
  await page.route('https://photon.komoot.io/**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q')!
    queries.push(query)
    await route.fulfill({
      json: {
        type: 'FeatureCollection',
        features:
          query === 'Arabica Kyoto'
            ? [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [135.7781237, 34.9992097],
                  },
                  properties: {
                    osm_type: 'N',
                    osm_id: 12345,
                    name: '% Arabica',
                    city: 'Kyoto',
                    country: 'Japan',
                    osm_key: 'amenity',
                    osm_value: 'cafe',
                  },
                },
              ]
            : [],
      },
    })
  })
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '새 장소 추가', exact: true }).click()
  await page.getByLabel('장소 또는 일정 이름').fill('아라비카교토')
  expect(queries).toEqual([])
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await page
    .getByRole('button', { name: '% Arabica 선택', exact: true })
    .click()
  expect(queries).toEqual(['아라비카교토', 'Arabica Kyoto'])
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  const stop = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[0].at(-1),
  )
  expect(stop.custom.coordinates).toEqual({ lat: 34.9992097, lng: 135.7781237 })
  expect(stop.custom.osmPlaceId).toBe('node/12345')
})
test('예약 연결 일정 이동·시간·여행 기간 변경은 원본 예약을 보존하며 충돌을 표시', async ({
  page,
}) => {
  await seed(page)
  await page
    .locator('.timeline-item')
    .getByText(/메모·날짜 변경/)
    .click()
  await page
    .getByLabel('기요미즈데라 이동할 날짜', { exact: true })
    .selectOption('1')
  await expect(page.locator('.reservation-conflicts')).toContainText(
    '일정 2026-11-02 10:00 / 예약 2026-11-01 10:00',
  )
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByLabel('출발일', { exact: true }).fill('2026-11-02')
  await page.getByLabel('마지막 날', { exact: true }).fill('2026-11-04')
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    '여행 기간 밖',
  )
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  const trip = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(trip.reservations[0].date).toBe('2026-11-01')
  expect(trip.days[1][0].note).toBe('개인 예약 메모')
  await expect(page.locator('.reservation-conflicts')).toContainText(
    '2026-11-03',
  )
})
test('예약·경비·새 여행 초안은 탭 이동과 재시작 뒤 복원하고 저장한 초안은 다시 만들지 않음', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '가계부')
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await page.getByLabel('지출 이름', { exact: true }).fill('공항 택시')
  await page.getByLabel('금액', { exact: true }).fill('3200')
  await tab(page, '예약')
  await tab(page, '가계부')
  await expect(page.getByLabel('지출 이름', { exact: true })).toHaveValue(
    '공항 택시',
  )
  await expect(page.getByLabel('금액', { exact: true })).toHaveValue('3200')
  await page.reload()
  await openTrips(page)
  await tab(page, '가계부')
  await expect(page.getByLabel('금액', { exact: true })).toHaveValue('3200')
  await tab(page, '예약')
  await page
    .getByRole('button', { name: '예약 정보 추가', exact: true })
    .click()
  await page.getByLabel('예약 이름', { exact: true }).fill('내 호텔 초안')
  await tab(page, '자료')
  await tab(page, '예약')
  await expect(page.getByLabel('예약 이름', { exact: true })).toHaveValue(
    '내 호텔 초안',
  )
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  await page.getByLabel('도시 이름', { exact: true }).fill('파리')
  await page.getByLabel('국가', { exact: true }).fill('프랑스')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  await expect(page.getByLabel('도시 이름', { exact: true })).toHaveValue(
    '파리',
  )
})
test('가이드와 주변 장소는 창을 교체하고 한 번에 닫으며 일정 터치 영역 유지', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 839 })
  await seed(page)
  await page.evaluate(() => scrollTo(0, 0))
  const first = await page.locator('.timeline-item').first().boundingBox()
  expect(first!.y).toBeLessThan(700)
  for (const name of ['여행 백업·공유', '기요미즈데라 지출 기록']) {
    const button = page.getByRole('button', { name, exact: true }).first()
    const box = await button.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  const category = page
    .getByRole('group', { name: '가볼 만한 곳 분류' })
    .getByRole('button', { name: '관광', exact: true })
  await category.click()
  await expect(category).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('기요미즈데라')
  for (let i = 0; i < 4; i++) {
    const peer = await page.locator('.nearby-places strong').first().innerText()
    await page.locator('.nearby-places button').first().click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(page.locator('.modal-backdrop')).toHaveCount(1)
    await expect(page.getByRole('dialog')).toHaveAccessibleName(peer)
    await expect(
      page.getByRole('button', { name: '닫기', exact: true }),
    ).toBeFocused()
    await expect
      .poll(() => page.locator('.modal').evaluate((n) => n.scrollTop))
      .toBe(0)
  }
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.modal-backdrop')).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe('')
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    '교토 여행 가이드',
  )
  await expect(
    page
      .getByRole('group', { name: '가볼 만한 곳 분류' })
      .getByRole('button', { name: '전체', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page
      .locator('.bottom-nav:visible,.desktop-nav:visible')
      .getByRole('button', { name: '홈', exact: true }),
  ).toHaveClass(/active/)
})
for (const closeWith of ['Escape', '배경'] as const) {
  test(`장소를 연속 전환한 뒤 ${closeWith} 한 번으로 닫고 이력을 남기지 않음`, async ({
    page,
  }) => {
    await seed(page)
    await page
      .locator('.desktop-nav:visible,.bottom-nav:visible')
      .getByRole('button', { name: '홈', exact: true })
      .click()
    await page
      .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
      .first()
      .click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
      .click()
    for (let i = 0; i < 2; i++) {
      const peer = await page
        .locator('.nearby-places strong')
        .first()
        .innerText()
      await page.locator('.nearby-places button').first().click()
      await expect(page.getByRole('dialog')).toHaveCount(1)
      await expect(page.getByRole('dialog')).toHaveAccessibleName(peer)
    }
    if (closeWith === 'Escape') await page.keyboard.press('Escape')
    else
      await page.locator('.modal-backdrop').click({ position: { x: 1, y: 1 } })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.modal-backdrop')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe('')
    await page
      .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
      .first()
      .click()
    await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}
test('60일 다도시 여행은 날짜 바로 이동·재시작·독립 백업으로 보존', async ({
  page,
}) => {
  const trip = fixture()
  trip.endDate = '2026-12-30'
  trip.days = Array.from({ length: 60 }, (_, i) =>
    i === 0 ? trip.days[0] : [],
  )
  expect(tripSchema.safeParse(trip).success).toBe(true)
  await seed(page, trip)
  await page.setViewportSize({ width: 320, height: 720 })
  await page.getByLabel('일정 날짜 바로 이동').selectOption('59')
  await expect(page.locator('.day-content')).toContainText('12월 30일')
  await page.reload()
  await openTrips(page)
  await expect(page.getByLabel('일정 날짜 바로 이동')).toHaveValue('59')
  await backup(page)
  await page
    .getByRole('button', { name: '전체 여행 백업 복사', exact: true })
    .click()
  const text = await page.getByLabel('내보낸 여행 내용').inputValue()
  expect(JSON.parse(text).trips[0].days).toHaveLength(60)
})
test('전체 백업은 PDF·개인 사진·대표 참조를 새 저장소에 복사하고 손상 ZIP은 거부', async ({
  page,
  browser,
}, info) => {
  await seed(page)
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await page
    .getByLabel('기요미즈데라 개인 사진 파일', { exact: true })
    .setInputFiles('public/images/place-gion.jpg')
  await expect(
    page.getByRole('button', { name: '내 사진 바꾸기', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '내 여행', exact: true })
    .click()
  await page.evaluate(async () => {
    const id = 'aaaa1111-1111-4111-8111-111111111111',
      text = '%PDF-1.4\nPRIVATE-BOOKING-PDF'
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('jido-attachments-v1', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('files')
      r.onsuccess = () => resolve(r.result)
      r.onerror = reject
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').put(
        new Blob([text], { type: 'application/pdf' }),
        id,
      )
      tx.oncomplete = () => resolve()
      tx.onerror = reject
    })
    db.close()
    const store = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    store.trips[0].attachments = [
      {
        id,
        name: '예약.pdf',
        mimeType: 'application/pdf',
        size: new Blob([text]).size,
        createdAt: '2026-10-16T00:00:00.000Z',
        storage: 'browser',
        reservationId: 'ticket',
      },
    ]
    localStorage.setItem('jido-travel-v1', JSON.stringify(store))
  })
  await page.reload()
  await openTrips(page)
  await backup(page)
  const event = page.waitForEvent('download')
  await page
    .getByRole('button', { name: '전체 백업 저장', exact: true })
    .click()
  const download = await event
  const file = info.outputPath('full.zip')
  await download.saveAs(file)
  const bytes = await readFile(file)
  const entries = unzipSync(bytes)
  const manifest = JSON.parse(strFromU8(entries['manifest.json']))
  expect(manifest.files).toHaveLength(2)
  expect(manifest.trips[0].reservations[0].reference).toBe('PRIVATE-TICKET')
  const next = await browser.newContext()
  const restored = await next.newPage()
  await restored.goto('http://127.0.0.1:5174')
  await restored
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '내 여행', exact: true })
    .click()
  await backup(restored)
  await restored
    .getByLabel('사진·자료 포함 백업 파일', { exact: true })
    .setInputFiles(file)
  await expect(
    restored.getByRole('button', { name: '사진·자료까지 복원', exact: true }),
  ).toBeVisible()
  await restored
    .getByRole('button', { name: '사진·자료까지 복원', exact: true })
    .click()
  await expect(restored.getByRole('status')).toContainText(
    '여행·사진·자료를 복사본으로 복원',
  )
  const data = await restored.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('jido-travel-v1')!),
    photos: JSON.parse(localStorage.getItem('jido-personal-photos-v1')!),
  }))
  const trip = data.store.trips[0]
  expect(trip.id).not.toBe('audit-fixes')
  expect(trip.days[0][0].note).toBe('개인 예약 메모')
  expect(
    trip.attachments.find((f: { name: string }) => f.name === '예약.pdf')
      .reservationId,
  ).toBe('ticket')
  expect(trip.days[0][0].photoId).toBe(data.photos['place:kiyomizu'].id)
  const pdf = trip.attachments.find(
    (f: { name: string }) => f.name === '예약.pdf',
  )
  expect(
    await restored.evaluate(async (id: string) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open('jido-attachments-v1', 1)
        r.onsuccess = () => resolve(r.result)
      })
      const value = await new Promise<Blob>((resolve) => {
        const r = db.transaction('files').objectStore('files').get(id)
        r.onsuccess = () => resolve(r.result)
      })
      db.close()
      return value.text()
    }, pdf.id),
  ).toContain('PRIVATE-BOOKING-PDF')
  const bad = { ...entries }
  const fileEntry = Object.keys(bad).find((k) => k.startsWith('files/'))!
  bad[fileEntry] = strToU8('damaged')
  await restored
    .getByLabel('사진·자료 포함 백업 파일', { exact: true })
    .setInputFiles({
      name: 'bad.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(zipSync(bad)),
    })
  await expect(restored.getByRole('alert')).toContainText('손상')
  expect(
    await restored.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.length,
    ),
  ).toBe(1)
  await restored.getByRole('button', { name: '닫기', exact: true }).click()
  await restored
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await restored
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await restored
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await restored.getByRole('button', { name: '기본 사진', exact: true }).click()
  await expect(
    restored.getByRole('button', { name: '내 사진 바꾸기', exact: true }),
  ).toHaveCount(0)
  expect(
    await restored.evaluate(async (id: string) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('jido-attachments-v1', 1)
        request.onsuccess = () => resolve(request.result)
      })
      const value = await new Promise<Blob | undefined>((resolve) => {
        const request = db.transaction('files').objectStore('files').get(id)
        request.onsuccess = () => resolve(request.result)
      })
      db.close()
      return value?.size ?? 0
    }, trip.days[0][0].photoId),
  ).toBeGreaterThan(0)
  await next.close()
})

test('Android 전체 백업·JSON 저장은 시스템 파일 저장 브리지를 쓰고 취소는 성공으로 표시하지 않음', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.backupCalls = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'TravelBackup',
          methods: [
            'exportArchive',
            'saveDocument',
            'inspectArchive',
            'discardArchive',
            'commitArchive',
          ].map((name) => ({ name, rtype: 'promise' })),
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.backupCalls.push({ plugin, method, options })
        return Promise.resolve({ cancelled: true })
      },
    }
  })
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await backup(page)
  await page
    .getByRole('button', { name: '전체 백업 저장', exact: true })
    .click()
  await expect(page.getByRole('status')).toContainText(
    '백업 저장을 취소했어요.',
  )
  await page
    .getByRole('button', { name: '백업 파일 저장', exact: true })
    .click()
  const calls = await page.evaluate(() => (window as any).backupCalls)
  expect(calls.map((c: any) => c.method)).toEqual([
    'exportArchive',
    'saveDocument',
  ])
  expect(JSON.parse(calls[0].options.manifest).format).toBe('jido-full-backup')
  expect(JSON.parse(calls[1].options.text).format).toBe('jdo-trips')
})

test('전체 복원 저장 실패는 기존 여행·대표 사진을 되돌림', async () => {
  const { commitFullRestore } = await import('../src/full-backup')
  const { personalPhotosSnapshot, replacePersonalPhotos } =
    await import('../src/personal-photos')
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  let fail = false
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => {
        if (fail && key === 'jido-travel-v1')
          throw new Error('TEST storage failure')
        values.set(key, value)
      },
      removeItem: (key: string) => values.delete(key),
    },
  })
  const before = personalPhotosSnapshot()
  try {
    const current = {
      version: 1 as const,
      savedCities: [],
      savedPlaces: [],
      trips: [fixture()],
    }
    values.set('jido-travel-v1', JSON.stringify(current))
    replacePersonalPhotos({})
    const file = {
      id: 'bbbb1111-1111-4111-8111-111111111111',
      name: '내 사진.jpg',
      mimeType: 'image/jpeg' as const,
      size: 10,
      createdAt: '2026-10-16T00:00:00.000Z',
      storage: 'browser' as const,
    }
    fail = true
    expect(() =>
      commitFullRestore(current, [{ ...fixture(), id: 'copy' }], {
        'place:kiyomizu': file,
      }),
    ).toThrow()
    expect(personalPhotosSnapshot()).toEqual({})
    expect(JSON.parse(values.get('jido-travel-v1')!).trips).toHaveLength(1)
  } finally {
    fail = false
    replacePersonalPhotos(before)
    if (descriptor)
      Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('현장 지출을 저장한 뒤 탭에 재진입해도 이미 처리한 초안을 다시 열지 않음', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('button', { name: '기요미즈데라 지출 기록', exact: true })
    .click()
  await page.getByLabel('금액', { exact: true }).fill('1000')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await tab(page, '예약')
  await tab(page, '가계부')
  await expect(page.getByLabel('지출 이름', { exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].expenses
          .length,
    ),
  ).toBe(1)
})

test('장소별 보강은 원문 근거·기존 사용자 문구를 보존하고 주변 거리는 실제 좌표만 사용', async () => {
  const { default: notes } = await import('../src/curated-place-notes.json', {
    with: { type: 'json' },
  })
  const { default: research } = await import(
    '../public/travel-place-sources.json',
    { with: { type: 'json' } }
  )
  const { places } = await import('../src/data')
  const { withBlogNotes } = await import('../src/blog-place-notes')
  const { nearbyPlaces } = await import('../src/NearbyPlaces')
  expect(notes).toHaveLength(42)
  for (const note of notes) {
    expect(research.places.find((p) => p.id === note.id)?.sourceUrl).toBe(
      note.sourceUrl,
    )
    const place = places.find((p) => p.id === note.id)!
    expect(place.description).toBe(note.description)
    expect(
      withBlogNotes({ ...place, tip: '내가 쓴 계획', description: '내 설명' }),
    ).toMatchObject({ tip: '내가 쓴 계획', description: '내 설명' })
    for (const item of nearbyPlaces(place)) {
      expect(item.place.cityId).toBe(place.cityId)
      expect(item.place.id).not.toBe(place.id)
      expect(item.distance).toBeLessThanOrEqual(3)
      expect(item.distance).toBeGreaterThanOrEqual(0)
    }
  }
  expect(
    nearbyPlaces(places.find((p) => p.id === 'guam-tumon-beach')!),
  ).toEqual([])
})
