import { openTrips, openWorkspace } from './navigation'
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function tab(page: Page, name: string) {
  await openWorkspace(page, name)
}
async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00Z'))
  await page.goto('/')
  await page.evaluate((extra) => {
    const stop = (
      id: string,
      name: string,
      time: string,
      status = 'planned',
      reservationId?: string,
    ) => ({
      id,
      placeId: 'custom-' + id,
      time,
      status,
      reservationId,
      note: id === 'next' ? '개인 메모 SECRET-NOTE' : '',
      custom: {
        name,
        kind: '관광',
        address: 'Paris France',
        link: 'https://example.com/SECRET-LINK',
        destinationId: 'paris',
        googlePlaceId: 'ChIJ-example-' + id,
      },
    })
    const reservation = (
      id: string,
      title: string,
      date: string,
      endDate: string,
      status = 'confirmed',
    ) => ({
      id,
      title,
      kind: '숙소',
      date,
      endDate,
      status,
      time: '15:00',
      reference: 'SECRET-BOOKING',
      address: '숙소 주소 Paris',
      link: '',
      note: 'SECRET-RESERVATION',
    })
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'private-trip',
            title: '우리 파리 여행',
            cityId: 'personal-paris',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            travelers: 2,
            members: [
              { id: 'me', name: '나' },
              { id: 'friend', name: '수진' },
            ],
            destinations: [{ id: 'paris', name: '파리', country: '프랑스' }],
            dayDestinationIds: ['paris', 'paris', 'paris'],
            days: [
              [],
              [
                stop('done', '완료한 장소', '08:00', 'done'),
                stop('next', '루브르', '13:00'),
                stop('later', '오르세', '11:00'),
                stop(
                  'cancelled',
                  '취소된 체험',
                  '14:00',
                  'planned',
                  'cancelled-booking',
                ),
              ],
              [],
            ],
            reservations: [
              reservation('old-hotel', '어제 숙소', '2026-11-01', '2026-11-02'),
              reservation('hotel', '오늘 숙소', '2026-11-02', '2026-11-03'),
              reservation(
                'cancelled-booking',
                '취소된 체험',
                '2026-11-02',
                '2026-11-03',
                'cancelled',
              ),
            ],
            expenses: [
              {
                id: 'expense',
                title: 'SECRET-EXPENSE',
                date: '2026-11-02',
                category: '기타',
                currency: 'EUR',
                amount: 50,
                payer: '나',
              },
            ],
            travelInfo: {
              emergencyPhone: '+33123456789',
              insurancePhone: '',
              embassyContact: 'SECRET-CONTACT',
              lodgingAddress: '',
              note: 'SECRET-TRAVEL',
            },
            ...extra,
          },
        ],
      }),
    )
  }, extra)
  await page.reload()
  await openTrips(page)
}

test('혼자 여행은 직접 고른 도시·빈 일정으로 시작하고 공용 추천 피드를 표시하지 않음', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.home-cities,.recommended')).toHaveCount(0)
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const form = page.getByRole('dialog')
  await expect(form.getByLabel('함께하는 인원')).toHaveValue('1')
  await expect(form.getByLabel('어디로 떠나세요?')).toHaveValue('custom')
  await form.getByLabel('도시 이름', { exact: true }).fill('리스본')
  await form.getByLabel('국가', { exact: true }).fill('포르투갈')
  await form
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.timeline-item')).toHaveCount(0)
  const trip = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(trip.travelers).toBe(1)
  expect(trip.members).toHaveLength(1)
  expect(trip.members[0].name).toBe('나')
  await tab(page, '가계부')
  await expect(
    page.getByRole('tab', { name: '정산', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await expect(page.getByLabel('비용 분담')).toHaveCount(0)
  await page.getByLabel('지출 이름', { exact: true }).fill('내 점심')
  await page.getByLabel('금액', { exact: true }).fill('12000')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(page.locator('.expense-list')).toContainText('내 점심')
})

test('오늘 날짜·사용자가 정한 방문 순서로 현장 실행, 완료·건너뛰기·취소 제외와 되돌리기', async ({
  page,
  context,
}) => {
  await seed(page)
  await tab(page, '여행 중')
  const field = page.getByRole('region', { name: '여행 중 빠른 실행' })
  await expect(field.getByLabel('현장에서 볼 날짜')).toHaveValue('1')
  await expect(field.locator('.field-next h2')).toHaveText('루브르')
  await expect(
    field.getByRole('link', { name: '길찾기', exact: true }).first(),
  ).toHaveAttribute('href', /destination_place_id=ChIJ-example-next/)
  await field.getByRole('button', { name: '방문 완료', exact: true }).click()
  await expect(field.locator('.field-next h2')).toHaveText('오르세')
  await field.getByRole('button', { name: '실행 취소', exact: true }).click()
  await expect(field.locator('.field-next h2')).toHaveText('루브르')
  await field.getByRole('button', { name: '이번 장소 건너뛰기' }).click()
  await expect(field.locator('.field-next h2')).toHaveText('오르세')
  await page.reload()
  await openTrips(page)
  await context.setOffline(true)
  await expect(field.locator('.field-next h2')).toHaveText('오르세')
  await field.getByRole('button', { name: '방문 완료', exact: true }).click()
  await expect(field).toContainText('남은 방문이 없어요')
  await expect(field.locator('.field-next')).not.toContainText('취소된 체험')
  await context.setOffline(false)
  await tab(page, '일정')
  await expect(page.getByLabel('루브르 방문 상태')).toHaveValue('skipped')
})

test('선택한 날의 숙소·확인서·연락처와 장소 지출을 탭 탐색 없이 연결', async ({
  page,
}) => {
  const fileId = '55555555-1111-4111-8111-111111111111'
  await seed(page, {
    attachments: [
      {
        id: fileId,
        name: '숙소확인서.txt',
        mimeType: 'text/plain',
        size: 12,
        createdAt: '2026-10-16T00:00:00.000Z',
        storage: 'browser',
        reservationId: 'hotel',
      },
    ],
  })
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('jido-attachments-v1', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('files')
      request.onsuccess = () => resolve(request.result)
    })
    await new Promise<void>((resolve) => {
      const tx = db.transaction('files', 'readwrite')
      tx.objectStore('files').put(
        new Blob(['hotel-ticket'], { type: 'text/plain' }),
        id,
      )
      tx.oncomplete = () => resolve()
    })
    db.close()
  }, fileId)
  await tab(page, '여행 중')
  const field = page.getByRole('region', { name: '여행 중 빠른 실행' })
  await expect(field.locator('.field-lodging')).toContainText('오늘 숙소')
  await expect(field.locator('.field-lodging')).not.toContainText('어제 숙소')
  await expect(field.locator('.field-lodging')).not.toContainText('취소된 체험')
  await expect(
    field.getByRole('region', { name: '예약 첨부 자료' }),
  ).toHaveCount(1)
  await field.getByRole('button', { name: '숙소확인서.txt 자료 열기' }).click()
  await expect(
    page.getByRole('dialog', { name: '숙소확인서.txt 미리보기' }),
  ).toContainText('hotel-ticket')
  await page.getByRole('button', { name: '자료 미리보기 닫기' }).click()
  await field.getByText('여행 연락처·메모', { exact: true }).click()
  await expect(
    field.getByRole('link', { name: '+33123456789' }),
  ).toHaveAttribute('href', 'tel:+33123456789')
  await field.getByRole('button', { name: '지출 기록', exact: true }).click()
  await expect(page.getByLabel('지출 이름', { exact: true })).toHaveValue(
    '루브르',
  )
  await expect(page.getByLabel('지출 날짜', { exact: true })).toHaveValue(
    '2026-11-02',
  )
})

test('동행자별 준비물 추가·템플릿·공용 필터가 섞이지 않고 각자의 같은 제목도 유지', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '준비물')
  await page.getByLabel('추가 항목 담당자').selectOption('me')
  await page.getByLabel('새 준비물').fill('여권 챙기기')
  await page
    .locator('.quick-add')
    .getByRole('button', { name: '추가', exact: true })
    .click()
  await page.getByLabel('추가 항목 담당자').selectOption('friend')
  await page.getByLabel('새 준비물').fill('여권 챙기기')
  await page
    .locator('.quick-add')
    .getByRole('button', { name: '추가', exact: true })
    .click()
  await page.getByLabel('준비 담당자 필터').selectOption('me')
  await expect(page.locator('.checklist')).toContainText('나')
  await expect(page.locator('.checklist')).not.toContainText('수진')
  await page.getByRole('button', { name: '기본 여행 준비 목록 넣기' }).click()
  await page.getByRole('button', { name: '기본 여행 준비 목록 넣기' }).click()
  const items = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].checklist,
  )
  expect(
    items.filter(
      (item: any) =>
        item.title === '여권 유효기간 확인' && item.assigneeId === 'friend',
    ),
  ).toHaveLength(1)
  expect(
    items.filter((item: any) => item.title === '여권 챙기기'),
  ).toHaveLength(2)
  await page.getByLabel('준비 담당자 필터').selectOption('shared')
  await expect(page.locator('.checklist')).not.toContainText('여권 챙기기')
})

test('동행자 제거 시 실제 여행 인원도 줄이고 기록에서 사용하는 사람은 삭제하지 못함', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '여행 준비')
  await page.getByRole('button', { name: '동행인 편집', exact: true }).click()
  await page
    .getByRole('button', { name: '수진 동행인 삭제', exact: true })
    .click()
  await page.getByRole('button', { name: '동행인 저장', exact: true }).click()
  await expect(page.locator('.trip-banner')).toContainText('1명')
  await tab(page, '가계부')
  await expect(
    page.getByRole('tab', { name: '정산', exact: true }),
  ).toHaveCount(0)
  await seed(page, {
    checklist: [
      { id: 'owned', title: '수진의 준비', done: false, assigneeId: 'friend' },
    ],
  })
  await tab(page, '여행 준비')
  await page.getByRole('button', { name: '동행인 편집', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '수진 동행인 삭제', exact: true }),
  ).toBeDisabled()
})

test('동행자 일정 전달은 민감한 기록 제외, 메모는 선택하고 앱용 파일로 독립 복원', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '일정')
  await page.getByLabel('동행자에게 일정 전달', { exact: true }).click()
  const text = page.getByLabel('동행자에게 전달할 내용')
  const initial = await text.inputValue()
  expect(initial).toContain('루브르')
  expect(initial).toContain('오늘 숙소')
  for (const secret of ['SECRET', '취소된 체험', '어제 숙소'])
    expect(initial).not.toContain(secret)
  await page.getByLabel('장소 메모 포함').check()
  await expect(text).toHaveValue(/SECRET-NOTE/)
  await page.getByLabel('장소 메모 포함').uncheck()
  const download = page.waitForEvent('download')
  await page
    .getByRole('button', { name: '앱용 일정 파일 전달', exact: true })
    .click()
  const file = await download
  const path = await file.path()
  const backup = JSON.parse(await readFile(path!, 'utf8'))
  expect(backup.trips[0].expenses).toBeUndefined()
  expect(
    backup.trips[0].reservations.some(
      (item: any) => item.title === '오늘 숙소',
    ),
  ).toBe(true)
  expect(
    backup.trips[0].reservations.every(
      (item: any) =>
        item.reference === '' && item.note === '' && item.cost === undefined,
    ),
  ).toBe(true)
  expect(backup.trips[0].travelInfo).toBeUndefined()
  expect(JSON.stringify(backup)).not.toContain('SECRET')
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.locator('.legacy-backup > summary').click()
  await page.getByLabel('여행 백업 파일').setInputFiles(path!)
  await page
    .getByRole('button', { name: '여행 복사본 가져오기', exact: true })
    .click()
  await expect(page.getByLabel('나의 여행')).toContainText('우리 파리 여행')
  const restored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips,
  )
  expect(restored).toHaveLength(2)
  expect(restored[0].expenses).toHaveLength(1)
  expect(restored[1].expenses).toBeUndefined()
})

test('날짜·작업 화면을 여행마다 기억하고 320px 현장 화면과 일정 전달 가로 넘침 방지', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 860 })
  await seed(page)
  await tab(page, '여행 중')
  await page.getByLabel('현장에서 볼 날짜').selectOption('2')
  await page.reload()
  await openTrips(page)
  await expect(page.getByLabel('현장에서 볼 날짜')).toHaveValue('2')
  await page.getByRole('button', { name: '오늘로 이동' }).click()
  await expect(page.getByLabel('현장에서 볼 날짜')).toHaveValue('1')
  await page.getByLabel('동행자에게 일정 전달', { exact: true }).click()
  await page.getByLabel('전달할 일정').selectOption('all')
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    )
    .toBe(false)
  const shareButtons = page.locator('.journey-share .row-actions button')
  for (const button of await shareButtons.all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  }
  await page.screenshot({
    path: `artifacts/personal-field-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('Android 공유 브리지 모형: 동행자 일정은 텍스트 또는 JSON 파일 공유 요청으로 전달', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.shareCalls = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'TravelSharing',
          methods: [{ name: 'share', rtype: 'promise' }],
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.shareCalls.push({ plugin, method, options })
        return Promise.resolve({})
      },
    }
  })
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await tab(page, '일정')
  await page.getByLabel('동행자에게 일정 전달', { exact: true }).click()
  await page.getByRole('button', { name: '일정 공유', exact: true }).click()
  await page
    .getByRole('button', { name: '앱용 일정 파일 전달', exact: true })
    .click()
  const calls = await page.evaluate(() => (window as any).shareCalls)
  expect(calls).toHaveLength(2)
  expect(calls[0]).toMatchObject({ plugin: 'TravelSharing', method: 'share' })
  expect(calls[0].options.text).toContain('루브르')
  expect(calls[0].options.text).not.toContain('SECRET')
  expect(JSON.parse(calls[1].options.json).trips).toHaveLength(1)
  expect(calls[1].options.json).not.toContain('SECRET')
})
