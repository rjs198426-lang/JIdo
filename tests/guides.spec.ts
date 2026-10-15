import { expect, test as base, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

type GuideBackend = { url: string; setupCode: string; password: string }
const test = base.extend<{ backend: GuideBackend }>({
  backend: async ({}, use) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'jdo-browser-guides-'))
    const setupCode = randomBytes(24).toString('hex')
    const password = randomBytes(24).toString('hex')
    const child = spawn(process.execPath, ['tests/start-guide-server.mjs'], {
      env: {
        ...process.env,
        GUIDE_DATA_DIR: directory,
        GUIDE_SETUP_CODE: setupCode,
        GUIDE_AI_API_KEY: 'test-only-' + randomBytes(10).toString('hex'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Test guide server startup timed out')),
        10000,
      )
      child.on('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`Test guide server exited: ${code}`))
      })
      child.stdout.on('data', (chunk) => {
        output += chunk.toString()
        const line = output.split('\n').find((line) => line.startsWith('{'))
        if (line) {
          clearTimeout(timer)
          const { port } = JSON.parse(line)
          resolve(`http://127.0.0.1:${port}`)
        }
      })
      child.stderr.on('data', () => {})
    })
    try {
      await use({ url, setupCode, password })
    } finally {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve()
        else child.once('exit', () => resolve())
      })
      await rm(directory, { recursive: true, force: true })
    }
  },
})

async function requestGuide(page: Page, backend: GuideBackend) {
  const response = await page.request.post(backend.url + '/api/requests', {
    data: {
      country: '오스트리아',
      city: '빈',
      notes: '대중교통과 산책 코스를 알고 싶어요.',
    },
  })
  expect(response.ok()).toBeTruthy()
}
async function setupAdmin(page: Page, backend: GuideBackend) {
  await page.goto(backend.url + '/admin')
  await page.getByLabel('초기 설정 코드').fill(backend.setupCode)
  await page.getByLabel('관리자 비밀번호').fill(backend.password)
  await page.getByRole('button', { name: '관리자 계정 만들기' }).click()
  await expect(
    page.getByRole('heading', { name: '어떤 여행지를 기다리고 있을까요?' }),
  ).toBeVisible()
}
async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}
async function publishGuide(page: Page, backend: GuideBackend) {
  await requestGuide(page, backend)
  await setupAdmin(page, backend)
  await expect(page.locator('.admin-list-row')).toContainText(
    '대중교통과 산책 코스',
  )
  await page
    .getByRole('button', { name: 'AI 조사·초안 작성', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '앱에 게시', exact: true }),
  ).toBeVisible()
  const before = await page.request.get(backend.url + '/api/guides')
  expect((await before.json()).guides).toHaveLength(0)
  await page
    .getByLabel('한 줄 소개', { exact: true })
    .fill('관리자가 검토한 빈 여행 가이드')
  await page.getByRole('tab', { name: /조사 본문/ }).click()
  await page
    .getByRole('textbox', { name: '조사 내용', exact: true })
    .fill(
      '관리자가 검토하고 수정한 교통 가이드입니다. 여행 전 공식 안내를 확인하세요.',
    )
  await page.getByRole('button', { name: '앱에 게시', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('가이드를 게시했습니다')
  const after = await page.request.get(backend.url + '/api/guides')
  const { guides } = await after.json()
  expect(guides).toHaveLength(1)
  await page.evaluate(
    (guides) =>
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          available: guides,
          retained: guides,
          usingServer: true,
        }),
      ),
    guides,
  )
}

test('요청 → AI 초안(테스트 응답) → 관리자 검토·게시 → 로컬 가이드로 일정 생성', async ({
  page,
  backend,
}) => {
  await publishGuide(page, backend)
  await page.goto(backend.url)
  await page.getByLabel('도시 또는 나라 검색').fill('빈')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await expect(page.locator('.city-card')).toHaveCount(1)
  await page
    .getByRole('button', { name: '빈 여행지 자세히 보기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    '관리자가 검토하고 수정한 교통 가이드',
  )
  await expect(page.getByRole('link', { name: /빈 관광청/ })).toHaveAttribute(
    'href',
    'https://www.wien.info/en',
  )
  await page
    .getByRole('button', { name: '빈 여행 만들기', exact: true })
    .click()
  await page.getByLabel('첫날에 추천 장소 3곳 넣어두기').check()
  await page.getByLabel('여행 이름').fill('빈 검토 여행')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.timeline-item')).toContainText('슈테판 대성당')
  await page
    .locator('.stop-card')
    .filter({ has: page.getByLabel('슈테판 대성당 메모') })
    .locator('.stop-edit-details > summary')
    .click()
  await page.getByLabel('슈테판 대성당 메모').fill('출처 확인한 장소 방문')
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.trip-banner')).toContainText('빈 검토 여행')
  await expect(page.getByLabel('슈테판 대성당 메모')).toHaveValue(
    '출처 확인한 장소 방문',
  )
})

test('서버 게시 상태에 관계없이 로컬 가이드와 기존 일정·저장 장소 유지', async ({
  page,
  backend,
}) => {
  await publishGuide(page, backend)
  await page.goto(backend.url)
  await navigate(page, '여행지')
  await page
    .getByRole('button', { name: '빈 여행지 자세히 보기', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '빈 저장', exact: true })
    .click()
  await page
    .getByRole('button', { name: '슈테판 대성당 저장', exact: true })
    .click()
  await page
    .getByRole('button', { name: '빈 여행 만들기', exact: true })
    .click()
  await page.getByLabel('첫날에 추천 장소 3곳 넣어두기').check()
  await page.getByLabel('여행 이름').fill('남겨둘 여행')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  const result = await page.request.post(
    backend.url + '/api/admin/guides/guide-vienna/unpublish',
  )
  expect(result.status()).toBe(200)
  await page.route('**/api/guides', (route) => route.abort())
  await page.reload()
  await navigate(page, '내 여행')
  await expect(page.locator('.trip-banner')).toContainText('남겨둘 여행')
  await expect(page.locator('.timeline-item')).toContainText('슈테판 대성당')
  await navigate(page, '저장한 곳')
  await expect(page.locator('.place-card')).toContainText('슈테판 대성당')
  await page.getByRole('tab', { name: '도시 1', exact: true }).click()
  await expect(page.locator('.city-card')).toContainText('빈')
})
