import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import { resortGuides } from '../src/resort-guides'
import { placeSchema } from '../src/guide-schema'
import { placeCoordinates, placeMapQuery } from '../src/place-location'
import { routePoints } from '../src/route-map-model'
import { portableTrip } from '../src/TravelBackup'
import { tripSchema } from '../src/travel-model'
import { openTrips } from './navigation'

async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}

test('괌·사이판은 휴양지에 명소 20곳씩 포함하고 미확인 위치를 만들지 않음', () => {
  expect(cities).toHaveLength(21)
  expect(places).toHaveLength(887)
  for (const guide of resortGuides) {
    expect(guide.city.region).toBe('휴양지')
    expect(guide.places).toHaveLength(20)
    expect(new Set(guide.places.map((place) => place.id)).size).toBe(20)
    for (const place of guide.places) {
      expect(place.name).toMatch(/[가-힣]/)
      expect(placeCoordinates(place)).toBeUndefined()
      expect(placeMapQuery(place)).toContain(place.english)
      expect(placeMapQuery(place)).not.toMatch(/undefined|NaN/)
      expect(place.reviewSources).toBeUndefined()
    }
  }
  const sample = resortGuides[0].places[0]
  expect(placeSchema.safeParse({ ...sample, lat: 0 }).success).toBe(false)
  expect(placeSchema.safeParse({ ...sample, lat: 0, lng: 0 }).success).toBe(
    true,
  )
  expect(placeSchema.safeParse({ ...sample, lat: 91, lng: 0 }).success).toBe(
    false,
  )
  expect(placeCoordinates({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0 })
})

test('휴양지 필터에 두 섬, 기본 사이판 전경·출처와 각 20개 장소를 표시', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await navigate(page, '여행지')
  await page.getByRole('button', { name: '휴양지', exact: true }).click()
  await expect(page.locator('.city-card')).toHaveCount(3)
  const saipan = page.getByRole('button', {
    name: '사이판 여행지 자세히 보기',
    exact: true,
  })
  await expect(saipan.locator('img')).toHaveAttribute(
    'src',
    '/images/saipan-coast.jpg',
  )
  await saipan.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).not.toContainText('지역별 하루 계획')
  await expect(dialog.getByRole('tab', { name: '지역별 코스', exact: true })).toBeVisible()
  await expect(
    dialog.getByText('상세 안내·기존 자료', { exact: true }),
  ).toHaveCount(0)
  await dialog.getByText('정보 확인·출처', { exact: true }).click()
  await expect(
    dialog.getByRole('link', { name: /관광청 공식 사이트/ }),
  ).toHaveAttribute('href', 'https://www.mymarianas.com/')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  for (const id of ['guam', 'saipan']) {
    await page.getByLabel('가볼 만한 곳의 도시').selectOption(id)
    await expect(page.locator('.place-card')).toHaveCount(20)
  }
})

test('위치가 없는 명소도 오프라인 일정·백업·재실행을 지원하고 0도 핀을 만들지 않음', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await navigate(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByLabel('가볼 만한 곳의 도시').selectOption('guam')
  await page
    .getByRole('button', { name: '사랑의 절벽 자세히 보기', exact: true })
    .click()
  await expect(
    page.getByRole('link', { name: '지도에서 이름으로 찾기', exact: true }),
  ).toHaveAttribute('href', /Two%20Lovers%20Point/)
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  await page
    .getByRole('button', { name: '이 장소와 여행 시작하기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.stop-place')).toContainText('사랑의 절벽')
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  const trip = tripSchema.parse(saved)
  expect(routePoints(trip.days[0])).toEqual([])
  const backup = JSON.parse(JSON.stringify(portableTrip(trip)))
  expect(tripSchema.safeParse(backup).success).toBe(true)
  expect(backup.days[0][0].custom.coordinates).toBeUndefined()
  expect(backup.days[0][0].custom.link).not.toMatch(/undefined|NaN|query=0/)
  expect(backup.days[0][0].custom.name).toBe('사랑의 절벽')
  await context.setOffline(false)
  await page.reload()
  await openTrips(page)
  await expect(page.locator('.stop-place')).toContainText('사랑의 절벽')
})
