import { test, expect, type Page } from '@playwright/test'
import { openTrips } from './navigation'
import { tripSchema, type Trip } from '../src/travel-model'
import { portableTrip } from '../src/TravelBackup'

const trip: Trip = {
  id: 'local-first',
  title: '교토 자유여행',
  cityId: 'kyoto',
  startDate: '2026-11-01',
  endDate: '2026-11-02',
  travelers: 1,
  members: [{ id: 'me', name: '나' }],
  days: [[], []],
}
async function state(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}
async function seed(page: Page, value = trip) {
  await page.route('https://**', (route) => route.abort())
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
    value,
  )
  await page.reload()
  await openTrips(page)
}

test('함께하는 인원은 나 제외 0명부터, 10명 선택·12명 직접 입력과 재실행·백업 보존', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await expect(page.getByLabel('함께하는 인원')).toHaveValue('0')
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  expect((await state(page)).travelers).toBe(1)
  for (const count of [10, 12, 0]) {
    await page
      .getByRole('button', { name: '여행 정보 수정', exact: true })
      .click()
    const field = page.getByLabel('함께하는 인원')
    if (count > 10) {
      await field.selectOption('custom')
      await page.getByLabel('동행 인원 직접 입력').fill(String(count))
    } else await field.selectOption(String(count))
    await page
      .getByRole('button', { name: '변경사항 저장', exact: true })
      .click()
    const saved = await state(page)
    expect(saved.travelers).toBe(count + 1)
    expect(saved.members).toHaveLength(count + 1)
    expect(tripSchema.safeParse(portableTrip(saved)).success).toBe(true)
    await expect(page.locator('.trip-banner')).toContainText(
      count ? `동행 ${count}명` : '나 혼자',
    )
  }
  await page.reload()
  await openTrips(page)
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await expect(page.getByLabel('함께하는 인원')).toHaveValue('0')
})

test('장소 추가 기본은 내장 가볼 곳, 검색은 기기 안에서 하고 없으면 이름을 넘겨 새로 등록', async ({
  page,
}) => {
  const calls: string[] = []
  page.on('request', (request) => {
    if (/photon|maps.googleapis/.test(request.url())) calls.push(request.url())
  })
  await seed(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await expect(page.getByLabel('등록된 가볼 곳')).toContainText('기요미즈데라')
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveCount(0)
  await page.getByLabel('일정에 추가할 장소 검색').fill('기요미즈')
  await page
    .getByRole('button', { name: '기요미즈데라 일정에 추가', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '기요미즈데라 추가됨', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('일정에 추가할 장소 검색').fill('골목의 작은 카페')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  expect(calls).toEqual([])
  await page
    .getByRole('button', {
      name: '‘골목의 작은 카페’ 새 장소 추가',
      exact: true,
    })
    .click()
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue(
    '골목의 작은 카페',
  )
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  expect((await state(page)).days[0]).toHaveLength(2)
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await page
    .getByRole('button', { name: '첫 장소 추가하기', exact: true })
    .click()
  await page.getByLabel('일정에 추가할 장소 검색').fill('골목의 작은 카페')
  await page
    .getByRole('button', { name: '골목의 작은 카페 일정에 추가', exact: true })
    .click()
  const saved = await state(page)
  expect(saved.days[1][0].custom.name).toBe('골목의 작은 카페')
  expect(saved.days[1][0].id).not.toBe(saved.days[0][1].id)
  expect(saved.days[1][0].note).toBe('')
  await expect(
    page.getByRole('button', { name: '골목의 작은 카페 추가됨', exact: true }),
  ).toBeDisabled()
})

test('검색창은 직접 등록한 장소도 보여주며 도시·날짜를 맞춰 재사용, 없으면 추가하기', async ({
  page,
}) => {
  await seed(page, {
    ...trip,
    days: [
      [
        {
          id: 'own',
          placeId: 'custom-own',
          time: '15:00',
          note: '개인 예약 메모',
          custom: {
            name: '나의 골목 카페',
            kind: '카페',
            address: '교토 골목 3',
            link: '',
            destinationId: 'kyoto',
            osmPlaceId: 'node/1234',
            coordinates: { lat: 35, lng: 135 },
          },
        },
      ],
      [],
    ],
  })
  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    value.trips.push({
      id: 'other-city',
      title: '다른 도시 여행',
      cityId: 'bali',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      travelers: 1,
      days: [[], []],
    })
    localStorage.setItem('jido-travel-v1', JSON.stringify(value))
    localStorage.setItem('jdo-active-trip-v1', 'other-city')
  })
  await page.reload()
  await openTrips(page)
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByLabel('여행지와 장소 검색').fill('나의 골목 카페')
  await expect(page.getByLabel('직접 등록한 장소 검색 결과')).toContainText(
    '나의 골목 카페',
  )
  await page
    .getByRole('button', { name: '나의 골목 카페 일정에 추가', exact: true })
    .click()
  await expect(page.getByLabel('추가할 여행')).toHaveValue('local-first')
  await page.getByLabel('어느 날에 갈까요?').selectOption('1')
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  const saved = await state(page)
  expect(saved.days[1][0].custom.osmPlaceId).toBe('node/1234')
  expect(saved.days[1][0].custom.coordinates).toEqual({ lat: 35, lng: 135 })
  expect(saved.days[1][0].note).toBe('')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByLabel('여행지와 장소 검색').fill('새 전망대')
  await page
    .getByRole('button', { name: '‘새 전망대’ 새 장소 추가', exact: true })
    .click()
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue('새 전망대')
})

test('인원을 줄일 때 경비·준비물에 연결된 동행인 기록은 보존', async ({
  page,
}) => {
  await seed(page, {
    ...trip,
    travelers: 2,
    members: [
      { id: 'me', name: '나' },
      { id: 'friend', name: '동행 1' },
    ],
    checklist: [
      { id: 'passport', title: '여권', done: false, assigneeId: 'friend' },
    ],
  })
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByLabel('함께하는 인원').selectOption('0')
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('동행인')
  expect((await state(page)).members).toHaveLength(2)
  expect((await state(page)).checklist[0].assigneeId).toBe('friend')
})

test('여행 없이 없는 장소를 검색하면 여행 생성 후 검색어를 유지해 등록', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByLabel('여행지와 장소 검색').fill('골목 전망대')
  await page
    .getByRole('button', { name: '‘골목 전망대’ 새 장소 추가', exact: true })
    .click()
  await expect(page.getByLabel('도시 이름', { exact: true })).toHaveValue('')
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByLabel('장소 또는 일정 이름')).toHaveValue(
    '골목 전망대',
  )
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  expect((await state(page)).days[0][0].custom.name).toBe('골목 전망대')
})
