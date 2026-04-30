import { expect, test } from '@playwright/test'

import {
  expectNoCriticalBrowserErrors,
  expectPageLoaded,
  failWithPlanItem,
  startReviewerPageMonitor,
} from './reviewer-exploratory'

test.describe('Reviewer exploratory smoke', () => {
  test('dashboard requests OpenClaw snapshot data and renders a usable shell', async ({ page }, testInfo) => {
    const monitor = startReviewerPageMonitor(page)
    const seenSnapshotRequests: string[] = []
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname
      if (pathname.startsWith('/api/openclaw/snapshot')) {
        seenSnapshotRequests.push(pathname)
      }
    })

    try {
      const snapshotRequest = page.waitForRequest(request => {
        const pathname = new URL(request.url()).pathname
        return pathname === '/api/openclaw/snapshot' || pathname === '/api/openclaw/snapshot/stream'
      }, { timeout: 10_000 })

      await expectPageLoaded(page, testInfo, '/dashboard', {
        title: 'Dashboard 入口白屏或不可访问',
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium` 后访问 `/dashboard`',
        expectation: '页面非白屏，能看到 Dashboard shell，并会请求 OpenClaw snapshot 或 stream 数据',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g dashboard`',
      })

      const request = await snapshotRequest
      expect(new URL(request.url()).pathname).toMatch(/^\/api\/openclaw\/snapshot(?:\/stream)?$/)
      expect(seenSnapshotRequests.length).toBeGreaterThan(0)

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
      await expect(page.getByText(/Connected|Disconnected/).first()).toBeVisible()
      await expect(page.getByText(/OpenClaw: (Live|Fallback)/).first()).toBeVisible()
      await expect(page.getByText(/Current Agents|Agent Status|Timeline View/).first()).toBeVisible()

      await expectNoCriticalBrowserErrors(testInfo, monitor, {
        title: 'Dashboard 入口存在关键浏览器错误',
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g dashboard`',
        expectation: 'Dashboard 加载与 snapshot 请求过程中无关键 console.error 或 pageerror',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g dashboard`',
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('Suggested ClawCompanyPlan.md item:')) throw error
      await failWithPlanItem(testInfo, {
        title: 'Dashboard exploratory smoke 失败',
        symptom: error instanceof Error ? error.message : String(error),
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g dashboard`',
        expectation: 'Dashboard 非白屏，发出 snapshot/stream 请求，并显示 Connected/Live 或合理 fallback 状态',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g dashboard`',
      })
    } finally {
      monitor.stop()
    }
  })

  test('office entry renders the virtual office surface', async ({ page }, testInfo) => {
    const monitor = startReviewerPageMonitor(page)

    try {
      await expectPageLoaded(page, testInfo, '/office', {
        title: 'Office 入口白屏或不可访问',
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office` 后访问 `/office`',
        expectation: '页面非白屏，核心办公室、角色或画布区域可见',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
      })

      const coreOfficeSurface = page.getByText(/Office|办公室|Agent Status|Current Agents|Timeline View|Dashboard/).first()
      await expect(coreOfficeSurface).toBeVisible()

      const roleOrCanvas = page.locator('canvas, [data-testid^="agent-card-"]')
      const roleOrCanvasCount = await roleOrCanvas.count()
      if (roleOrCanvasCount === 0) {
        await failWithPlanItem(testInfo, {
          title: 'Office 入口缺少办公室角色或画布',
          symptom: '`/office` 页面可打开，但未找到 `canvas` 或 `[data-testid^="agent-card-"]` 角色卡',
          reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
          expectation: '`/office` 非白屏，并显示办公室/角色/画布等核心区域',
          verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
        })
      }
      await expect(roleOrCanvas.first()).toBeVisible()

      await expectNoCriticalBrowserErrors(testInfo, monitor, {
        title: 'Office 入口存在关键浏览器错误',
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
        expectation: 'Office 加载过程中无关键 console.error 或 pageerror',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('Suggested ClawCompanyPlan.md item:')) throw error
      await failWithPlanItem(testInfo, {
        title: 'Office exploratory smoke 失败',
        symptom: error instanceof Error ? error.message : String(error),
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
        expectation: '`/office` 非白屏，并显示办公室/角色/画布等核心区域',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g office`',
      })
    } finally {
      monitor.stop()
    }
  })

  test('walk work entry renders the core workspace', async ({ page }, testInfo) => {
    const monitor = startReviewerPageMonitor(page)

    try {
      await expectPageLoaded(page, testInfo, '/walk/work', {
        title: 'Walk work 入口白屏或不可访问',
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g "walk work"` 后访问 `/walk/work`',
        expectation: '页面非白屏，核心工作区可见',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g "walk work"`',
      })

      const workspace = page.getByText(/Work|Workspace|工作区|任务|Dashboard|Agent Status|Timeline View/).first()
      await expect(workspace).toBeVisible()

      await expectNoCriticalBrowserErrors(testInfo, monitor, {
        title: 'Walk work 入口存在关键浏览器错误',
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g "walk work"`',
        expectation: '`/walk/work` 加载过程中无关键 console.error 或 pageerror',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g "walk work"`',
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('Suggested ClawCompanyPlan.md item:')) throw error
      await failWithPlanItem(testInfo, {
        title: 'Walk work exploratory smoke 失败',
        symptom: error instanceof Error ? error.message : String(error),
        reproduction: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g "walk work"`',
        expectation: '`/walk/work` 非白屏，并显示核心工作区',
        verification: '`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium -g "walk work"`',
      })
    } finally {
      monitor.stop()
    }
  })
})
