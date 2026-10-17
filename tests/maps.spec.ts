import { openTrips, openWorkspace } from './navigation'
import { test, expect, type Page } from '@playwright/test'
import { parseMapsShare, googleMapsLink } from '../src/google-maps'

test('지도 공유 파싱은 원본 링크를 보존하고 짧은 링크의 장소를 추측하지 않는다', () => {
  expect(parseMapsShare('에펠탑\nhttps://maps.app.goo.gl/Example')).toEqual({
    name: '에펠탑',
    link: 'https://maps.app.goo.gl/Example',
  })
  expect(parseMapsShare('https://maps.app.goo.gl/Example').name).toBe('')
  expect(
    parseMapsShare('https://www.google.com/maps/place/Eiffel+Tower/@48,2,17z')
      .name,
  ).toBe('Eiffel Tower')
  expect(
    parseMapsShare('https://www.google.com/maps/search/?api=1&query=48.3,2.1')
      .name,
  ).toBe('')
  for (const url of [
    'https://google.com.evil.test/maps/foo',
    'javascript:alert(1)',
    'https://user@www.google.com/maps/foo',
    'https://evil.test',
  ])
    expect(googleMapsLink(url)).toBeNull()
})

async function tripPage(page: Page) {
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'maps-trip',
            title: '파리 여행',
            cityId: 'custom-paris',
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            travelers: 1,
            days: [[], []],
            destinations: [{ id: 'paris', name: '파리', country: '프랑스' }],
            dayDestinationIds: ['paris', 'paris'],
          },
        ],
      }),
    ),
  )
  await page.reload()
  await openTrips(page)
}
// Google SDK response fixtures verify the selection flow; they are not live Google results.
async function sdkFixture(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('jido-place-search-service', 'google')
    const target = window as any
    target.mapsRequests = []
    target.externalOpens = 0
    window.open = () => {
      target.externalOpens++
      return null
    }
    const make = (
      id: string,
      name: string,
      address: string,
      lat: number,
      lng: number,
      types = ['tourist_attraction'],
    ) => ({
      id,
      displayName: name,
      formattedAddress: address,
      location: { lat: () => lat, lng: () => lng },
      types,
    })
    target.google = {
      maps: {
        importLibrary: async () => ({
          Place: {
            searchByText: async (request: any) => {
              target.mapsRequests.push(request)
              if (request.textQuery.includes('연결실패'))
                throw new Error('REQUEST_DENIED')
              if (request.textQuery.includes('결과없음')) return { places: [] }
              if (request.textQuery.includes('느린검색'))
                return new Promise((resolve) => {
                  target.resolveOldSearch = () =>
                    resolve({
                      places: [
                        make('old', '이전 검색 결과', 'Old address', 1, 2),
                      ],
                    })
                })
              return {
                places: [
                  make(
                    'eiffel-tower',
                    '에펠탑',
                    'Champ de Mars, 5 Av. Anatole France, Paris',
                    48.8584,
                    2.2945,
                  ),
                  make(
                    'eiffel-cafe',
                    '에펠 카페',
                    '7 Rue de Paris, Paris',
                    48.85,
                    2.29,
                    ['cafe'],
                  ),
                ],
              }
            },
          },
        }),
      },
    }
  })
}

test('구글 결과를 앱에서 선택하고 주소·좌표·장소 ID를 일정과 초안에 보관', async ({
  page,
  context,
}) => {
  await sdkFixture(page)
  await tripPage(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '찾기', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('장소 또는 일정 이름').fill('에펠탑')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '에펠탑 선택', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '에펠 카페 선택', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => (window as any).externalOpens)).toBe(0)
  const requests = await page.evaluate(() => (window as any).mapsRequests)
  expect(requests[0].textQuery).toBe('파리 프랑스 에펠탑')
  expect(requests[0].fields).toContain('location')
  await page
    .getByRole('button', { name: '에펠 카페 선택', exact: true })
    .click()
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue('에펠 카페')
  await expect(page.getByLabel('일정 유형')).toHaveValue('카페')
  await page.getByText('주소·링크·메모', { exact: true }).click()
  await expect(page.getByLabel('주소', { exact: true })).toHaveValue(
    '7 Rue de Paris, Paris',
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  await openTrips(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue('에펠 카페')
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  await context.setOffline(true)
  await page.getByLabel('에펠 카페 방문 시간').fill('11:30')
  await context.setOffline(false)
  await page.reload()
  await openTrips(page)
  await expect(page.getByLabel('에펠 카페 방문 시간')).toHaveValue('11:30')
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[0][0]
        .custom,
  )
  expect(saved.googlePlaceId).toBe('eiffel-cafe')
  expect(saved.coordinates).toEqual({ lat: 48.85, lng: 2.29 })
  await openWorkspace(page, '동선')
  await expect(
    page.getByRole('link', { name: '에펠 카페 지도 검색' }),
  ).toHaveAttribute('href', /query_place_id=eiffel-cafe/)
  await page.getByRole('button', { name: '여행 백업·공유' }).click()
  await page.locator('.legacy-backup > summary').click()
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  await expect(page.getByLabel('내보낸 여행 내용')).toHaveValue(/eiffel-cafe/)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
})

test('결과 없음·연결 실패·오프라인은 앱 안에서 표시하고 외부 창을 열지 않음', async ({
  page,
  context,
}) => {
  await sdkFixture(page)
  await tripPage(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByLabel('장소 또는 일정 이름').fill('결과없음')
  await page.getByLabel('장소 또는 일정 이름').press('Enter')
  await expect(page.getByRole('status')).toContainText('검색 결과가 없습니다')
  await page.getByLabel('장소 또는 일정 이름').fill('연결실패')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('연결할 수 없습니다')
  await context.setOffline(true)
  await page.getByLabel('장소 또는 일정 이름').fill('에펠탑')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('인터넷')
  expect(await page.evaluate(() => (window as any).externalOpens)).toBe(0)
})

test('느린 응답이 변경된 검색 결과를 덮어쓰지 않음', async ({ page }) => {
  await sdkFixture(page)
  await tripPage(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByLabel('장소 또는 일정 이름').fill('느린검색')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('장소 찾는 중')
  await page.getByLabel('장소 또는 일정 이름').fill('에펠탑')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '에펠탑 선택', exact: true }),
  ).toBeVisible()
  await page.evaluate(() => (window as any).resolveOldSearch())
  await expect(page.getByText('이전 검색 결과', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '에펠탑 선택', exact: true }),
  ).toBeVisible()
})

test('추천 장소 선택 화면에서도 구글 결과를 골라 바로 일정 추가', async ({
  page,
}) => {
  await sdkFixture(page)
  await tripPage(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '추천 장소에서 선택' }).click()
  await page.getByLabel('일정에 추가할 장소 검색').fill('에펠탑')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await page.getByRole('button', { name: '에펠탑 선택', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.timeline-item')).toContainText('에펠탑')
  expect(await page.evaluate(() => (window as any).externalOpens)).toBe(0)
})

test('기기 내 장소를 찾을 때는 구글 호출 없이 선택', async ({ page }) => {
  await sdkFixture(page)
  await tripPage(page)
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    state.trips[0].destinations[0] = {
      id: 'paris',
      name: '교토',
      country: '일본',
      guideCityId: 'kyoto',
    }
    localStorage.setItem('jido-travel-v1', JSON.stringify(state))
  })
  await page.reload()
  await openTrips(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByLabel('장소 또는 일정 이름').fill('기요미즈')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await page.locator('.place-find-results').getByRole('button').click()
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue(
    '기요미즈데라',
  )
  expect(await page.evaluate(() => (window as any).mapsRequests)).toEqual([])
})

test('검색 연결이 없으면 설정 오류를 알리고 외부 지도나 가짜 결과를 표시하지 않음', async ({
  page,
}) => {
  await page.route('**/maps.googleapis.com/**', (route) => route.abort())
  await page.addInitScript(() => {
    localStorage.setItem('jido-place-search-service', 'google')
    ;(window as any).externalOpens = 0
    window.open = () => {
      ;(window as any).externalOpens++
      return null
    }
  })
  await tripPage(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByLabel('장소 또는 일정 이름').fill('에펠탑')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/설정되지|연결할 수/)
  await expect(page.locator('[aria-label="구글 장소 검색 결과"]')).toHaveCount(
    0,
  )
  expect(await page.evaluate(() => (window as any).externalOpens)).toBe(0)
})
