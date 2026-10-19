import { openTrips } from './navigation'
import { test, expect, type Page } from '@playwright/test'
const feature = (
  id = 501,
  name = 'Eiffel Tower',
  coordinates = [2.2945, 48.8584],
) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: {
    osm_type: 'W',
    osm_id: id,
    name,
    street: 'Avenue Anatole France',
    housenumber: '5',
    city: 'Paris',
    country: 'France',
    osm_key: 'tourism',
    osm_value: 'attraction',
  },
})
const body = { type: 'FeatureCollection', features: [feature()] }
async function seed(page: Page, custom?: Record<string, unknown>) {
  await page.goto('/')
  await page.evaluate(
    (custom) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [
            {
              id: 'free-trip',
              title: '파리 자유여행',
              cityId: 'personal-paris',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
              travelers: 1,
              destinations: [
                { id: 'paris', name: '파리', country: '프랑스' },
                { id: 'rome', name: '로마', country: '이탈리아' },
              ],
              dayDestinationIds: ['paris', 'rome'],
              days: [
                custom
                  ? [
                      {
                        id: 'external-stop',
                        placeId: 'custom-external',
                        time: '10:00',
                        note: '내 메모',
                        custom,
                      },
                    ]
                  : [],
                [],
              ],
            },
          ],
        }),
      ),
    custom,
  )
  await page.reload()
  await openTrips(page)
}
async function add(page: Page) {
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '새 장소 추가', exact: true }).click()
}
async function find(page: Page, query = 'Eiffel Tower') {
  await page.getByLabel('장소 또는 일정 이름').fill(query)
  await page.getByRole('button', { name: '찾기', exact: true }).click()
}
async function saved(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[0],
  )
}

test('키·결제 없이 무료 검색이 기본이고 OSM 이름·주소·좌표를 선택·저장·복원', async ({
  page,
}) => {
  const calls: string[] = []
  await page.addInitScript(() => {
    ;(window as any).paidCalls = 0
    ;(window as any).google = {
      maps: {
        importLibrary: () => {
          ;(window as any).paidCalls++
          throw new Error('Must not charge')
        },
      },
    }
  })
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    calls.push(route.request().url())
    await route.fulfill({ json: body })
  })
  await seed(page)
  await add(page)
  await expect(page.getByLabel('장소 검색 서비스')).toHaveValue('osm')
  await find(page)
  await expect(
    page.getByRole('link', { name: '© OpenStreetMap contributors · ODbL' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Eiffel Tower 선택', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  const custom = (await saved(page))[0].custom
  expect(custom.name).toBe('Eiffel Tower')
  expect(custom.address).toContain('Paris')
  expect(custom.coordinates).toEqual({ lat: 48.8584, lng: 2.2945 })
  expect(custom.osmPlaceId).toBe('way/501')
  expect(custom.googlePlaceId).toBeUndefined()
  expect(custom.link).toBe('https://www.openstreetmap.org/way/501')
  expect(calls).toHaveLength(1)
  expect(new URL(calls[0]).searchParams.get('countrycode')).toBe('FR')
  expect(new URL(calls[0]).searchParams.has('key')).toBe(false)
  expect(await page.evaluate(() => (window as any).paidCalls)).toBe(0)
  await page.reload()
  await openTrips(page)
  await expect(page.locator('.timeline')).toContainText('Eiffel Tower')
  await expect(page.locator('.place-source a')).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/copyright',
  )
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.locator('.legacy-backup > summary').click()
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  expect(await page.getByLabel('내보낸 여행 내용').inputValue()).toContain(
    'way/501',
  )
})

test('입력만 할 때 요청하지 않고 같은 검색은 저장된 결과로 재사용·오프라인 선택', async ({
  page,
  context,
}) => {
  let calls = 0
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    calls++
    await route.fulfill({ json: body })
  })
  await seed(page)
  await add(page)
  await page.getByLabel('장소 또는 일정 이름').fill('Eiffel Tower')
  expect(calls).toBe(0)
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Eiffel Tower 선택' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Eiffel Tower 선택' }),
  ).toBeVisible()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  await openTrips(page)
  await context.setOffline(true)
  await add(page)
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await page.getByRole('button', { name: 'Eiffel Tower 선택' }).click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  expect((await saved(page))[0].custom.osmPlaceId).toBe('way/501')
  expect(calls).toBe(1)
  await context.setOffline(false)
})

test('검색 실패·결과 없음에도 직접 추가를 막지 않고 빈 좌표를 0으로 저장하지 않음', async ({
  page,
}) => {
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    await route.fulfill(
      new URL(route.request().url()).searchParams.get('q') === '없는장소'
        ? { json: { features: [] } }
        : { status: 503, body: 'temporarily unavailable' },
    )
  })
  await seed(page)
  await add(page)
  await find(page, '없는장소')
  await expect(page.getByRole('status')).toContainText('영문·현지명')
  await find(page, '숙소')
  await expect(page.getByRole('alert')).toContainText('무료 장소 검색')
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  expect((await saved(page))[0].custom.coordinates).toBeUndefined()
})

test('주소·좌표는 숨기고 유효한 과거 초안·0도 좌표와 메모를 오프라인 보존', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page.evaluate(() =>
    localStorage.setItem(
      'jdo-place-draft:free-trip:0:new',
      JSON.stringify({
        name: '강변 만남',
        kind: '체험',
        address: '과거 주소',
        link: '',
        destinationId: 'paris',
        latitude: '48.85',
        longitude: '0',
        note: '강변에서 만나기',
        time: '15:30',
      }),
    ),
  )
  await context.setOffline(true)
  await add(page)
  const form = page.getByRole('dialog')
  await expect(form.getByLabel('메모', { exact: true })).toHaveValue(
    '강변에서 만나기',
  )
  await expect(form.getByLabel('방문 시간', { exact: true })).toHaveValue(
    '15:30',
  )
  await expect(form.getByLabel('일정 유형')).toHaveValue('체험')
  await expect(form.getByLabel('주소', { exact: true })).toHaveCount(0)
  await expect(form.getByLabel('장소 위도')).toHaveCount(0)
  await expect(form.getByLabel('장소 경도')).toHaveCount(0)
  await expect(form).not.toContainText('과거 주소')
  await form
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  expect((await saved(page))[0]).toMatchObject({
    time: '15:30',
    note: '강변에서 만나기',
    custom: {
      address: '과거 주소',
      kind: '체험',
      coordinates: { lat: 48.85, lng: 0 },
    },
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await context.setOffline(false)
})

test('과거 초안의 부분 좌표는 숨겨진 오류나 0도 위치를 만들지 않음', async ({
  page,
}) => {
  await seed(page)
  await page.evaluate(() =>
    localStorage.setItem(
      'jdo-place-draft:free-trip:0:new',
      JSON.stringify({
        name: '좌표 없는 약속',
        kind: '기타',
        address: '',
        link: '',
        destinationId: 'paris',
        latitude: '48.85',
        longitude: '',
        note: '입력한 메모',
        time: '10:00',
      }),
    ),
  )
  await add(page)
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  expect((await saved(page))[0].custom.coordinates).toBeUndefined()
  expect((await saved(page))[0].note).toBe('입력한 메모')
})

test('장소 이름·도시를 바꾸면 이전 위치·지도 링크·장소 ID로 안내하지 않음', async ({
  page,
}) => {
  for (const change of ['name', 'legacy-name', 'city']) {
    await seed(page, {
      name: 'Eiffel Tower',
      kind: '관광',
      address: 'Paris',
      link: 'https://www.openstreetmap.org/way/501',
      destinationId: 'paris',
      ...(change !== 'legacy-name'
        ? { osmPlaceId: 'way/501', coordinates: { lat: 48.8584, lng: 2.2945 } }
        : {}),
    })
    await page.locator('.stop-place button').click()
    if (change === 'name' || change === 'legacy-name')
      await page.getByLabel('장소 또는 일정 이름').fill('새 장소')
    if (change === 'city')
      await page.getByLabel('일정의 도시').selectOption('rome')
    await page
      .getByRole('button', { name: '직접 추가한 일정 수정', exact: true })
      .click()
    const custom = (await saved(page))[0].custom
    expect(custom.address).toBe('')
    expect(custom.osmPlaceId).toBeUndefined()
    expect(custom.coordinates).toBeUndefined()
    expect(custom.link).toBe('')
    expect((await saved(page))[0].note).toBe('내 메모')
  }
})

test('지도 공유 링크로 바꿀 때 이전 검색의 주소·좌표·ID를 섞지 않음', async ({
  page,
}) => {
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({ json: body }),
  )
  await seed(page)
  await add(page)
  await find(page)
  await page
    .getByRole('button', { name: 'Eiffel Tower 선택', exact: true })
    .click()
  await page.getByText('지도 공유 링크로 지정', { exact: true }).click()
  await page
    .getByLabel('공유 링크 또는 공유 텍스트')
    .fill('다른 장소\nhttps://maps.app.goo.gl/Example')
  await page.getByRole('button', { name: '이 장소 적용', exact: true }).click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  const custom = (await saved(page))[0].custom
  expect(custom.name).toBe('다른 장소')
  expect(custom.link).toBe('https://maps.app.goo.gl/Example')
  expect(custom.address).toBe('')
  expect(custom.coordinates).toBeUndefined()
  expect(custom.osmPlaceId).toBeUndefined()
})

test('늦게 도착한 무료 결과는 다른 검색어·서비스 선택을 덮어쓰지 않음', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  let started = false
  await page.route('https://photon.komoot.io/api/**', async (route) => {
    started = true
    await gate
    await route.fulfill({ json: body })
  })
  await seed(page)
  await add(page)
  await find(page)
  await expect.poll(() => started).toBe(true)
  await page.getByLabel('장소 또는 일정 이름').fill('다른 장소')
  await page.getByLabel('장소 검색 서비스').selectOption('google')
  release()
  await expect
    .poll(() =>
      page.evaluate(
        () => localStorage.getItem('jido-free-place-search-v1') !== null,
      ),
    )
    .toBe(true)
  await expect(
    page.getByRole('button', { name: 'Eiffel Tower 선택' }),
  ).toHaveCount(0)
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue('다른 장소')
})

test('손상된 저장 검색·잘못된 좌표·없는 이름을 거르고 실제 결과의 중복을 제거', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'jido-free-place-search-v1',
      JSON.stringify({
        evil: {
          at: Date.now(),
          places: [{ name: '가짜 저장 결과', link: 'javascript:alert(1)' }],
        },
      }),
    ),
  )
  await page.route('https://photon.komoot.io/api/**', (route) =>
    route.fulfill({
      json: {
        features: [
          feature(),
          feature(),
          feature(502, 'Bad', [200, 100]),
          { ...feature(503), properties: { osm_type: 'W', osm_id: 503 } },
          {
            ...feature(504),
            geometry: { type: 'Point', coordinates: [null, null] },
          },
          {
            ...feature(505),
            geometry: { type: 'Point', coordinates: { lat: 48, lng: 2 } },
          },
          {
            ...feature(506),
            properties: { osm_type: 'toString', osm_id: 506, name: 'bad type' },
          },
        ],
      },
    }),
  )
  await seed(page)
  await add(page)
  await find(page)
  await expect(
    page.locator('[aria-label="무료 장소 검색 결과"] button'),
  ).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Eiffel Tower 선택' }),
  ).toBeVisible()
  await expect(page.getByText('가짜 저장 결과')).toHaveCount(0)
})

test('Android 브리지로 무료 검색을 요청하며 이름·주소·좌표를 일정에 적용', async ({
  page,
}) => {
  await page.addInitScript((body) => {
    const w = window as any
    w.freeNativeCalls = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'CapacitorHttp',
          methods: [
            { name: 'get', rtype: 'promise' },
            { name: 'request', rtype: 'promise' },
          ],
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.freeNativeCalls.push({ plugin, method, options })
        return Promise.resolve({
          status: 200,
          data: body,
          headers: {},
          url: options.url,
        })
      },
    }
  }, body)
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await add(page)
  await find(page)
  await page.getByRole('button', { name: 'Eiffel Tower 선택' }).click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  const calls = await page.evaluate(() => (window as any).freeNativeCalls)
  expect(calls[0].options.url).toContain('https://photon.komoot.io/api/')
  expect(calls[0].options.headers['User-Agent']).toContain('JidoTravel')
  expect((await saved(page))[0].custom.coordinates).toEqual({
    lat: 48.8584,
    lng: 2.2945,
  })
})

test('수정 화면에서 유형·시각·메모만 바꾸면 숨긴 위치와 기존 참조를 보존', async ({
  page,
}) => {
  const custom = {
    name: 'Eiffel Tower',
    kind: '관광',
    address: 'Paris hidden address',
    link: 'https://www.google.com/maps/search/?api=1&query=Eiffel+Tower&query_place_id=eiffel',
    destinationId: 'paris',
    googlePlaceId: 'eiffel',
    coordinates: { lat: 48.8584, lng: 2.2945 },
  }
  await seed(page, custom)
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    Object.assign(state.trips[0].days[0][0], {
      photoId: 'ec240e74-951b-41c1-94da-ffde24e24f5c',
      status: 'done',
      durationMinutes: 90,
    })
    localStorage.setItem('jido-travel-v1', JSON.stringify(state))
  })
  await page.reload()
  await openTrips(page)
  const before = (await saved(page))[0]
  await page.locator('.stop-place button').click()
  const form = page.getByRole('dialog')
  await expect(form.getByLabel('메모', { exact: true })).toHaveValue('내 메모')
  await expect(form).not.toContainText('Paris hidden address')
  await form.getByLabel('일정 유형').selectOption('체험')
  await form.getByLabel('방문 시간', { exact: true }).fill('14:20')
  await form
    .getByLabel('메모', { exact: true })
    .fill('우천이면 실내 코스로 변경')
  await form
    .getByRole('button', { name: '직접 추가한 일정 수정', exact: true })
    .click()
  expect((await saved(page))[0]).toEqual({
    ...before,
    time: '14:20',
    note: '우천이면 실내 코스로 변경',
    custom: { ...before.custom, kind: '체험' },
  })
  await page.reload()
  await openTrips(page)
  await page.locator('.stop-place button').click()
  await expect(page.getByLabel('메모', { exact: true })).toHaveValue(
    '우천이면 실내 코스로 변경',
  )
  await expect(page.getByLabel('방문 시간', { exact: true })).toHaveValue(
    '14:20',
  )
  await expect(page.getByLabel('일정 유형')).toHaveValue('체험')
})
