/**
 * Core E2E Tests — CI-safe, mock-based
 *
 * These tests run in CI without any external dependencies.
 * The /api/agent endpoint is intercepted via route.fulfill() to
 * return a streaming SSE payload so we never hit a real LLM.
 *
 * Tests that need a real OpenClaw gateway are in openclaw.spec.ts
 * (gated by OPENCLAW_ENABLED=true env var).
 */

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helper: fake a streaming SSE response (simulates /api/agent POST)
// ---------------------------------------------------------------------------
function makeSSEBody(content: string): string {
  // The app reads Server-Sent Events with data: <json>\n\n format
  const chunks = content.match(/.{1,20}/g) ?? [content]
  const events = chunks.map(c =>
    `data: ${JSON.stringify({ type: 'content', content: c })}\n\n`
  )
  events.push('data: [DONE]\n\n')
  return events.join('')
}

// ---------------------------------------------------------------------------
// Suite 1: Landing Page – no network required
// ---------------------------------------------------------------------------
test.describe('Landing Page', () => {
  test('should load and display key elements', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Page title
    await expect(page).toHaveTitle(/AI Team/)

    // Hero headline
    await expect(page.locator('h1')).toContainText('One Person')

    // Three agent cards
    await expect(page.getByText('PM Claw')).toBeVisible()
    await expect(page.getByText('Dev Claw')).toBeVisible()
    await expect(page.getByText('Reviewer Claw')).toBeVisible()

    // CTA link
    const cta = page.getByRole('link', { name: /start chatting/i })
    await expect(cta).toBeVisible()
  })

  test('Start Chatting should navigate to /team', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /start chatting/i }).click()
    await page.waitForURL('**/team')
    expect(page.url()).toContain('/team')
  })
})

// ---------------------------------------------------------------------------
// Suite 2: Team Portal UI – no network required
// ---------------------------------------------------------------------------
test.describe('Team Portal UI', () => {
  test('should display chat input and send button', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder(/输入你的需求/i)
    await expect(input).toBeVisible()

    const sendButton = page.getByRole('button', { name: /发送/i })
    await expect(sendButton).toBeDisabled() // empty input → disabled
  })

  test('send button enables when input has content', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder(/输入你的需求/i)
    const sendButton = page.getByRole('button', { name: /发送/i })

    await expect(sendButton).toBeDisabled()
    await input.fill('Test requirement')
    await expect(sendButton).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Suite 3: Agent interaction with mocked API
// ---------------------------------------------------------------------------
test.describe('Agent interaction (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept /api/agent POST and return a fake streaming response
    await page.route('**/api/agent', async route => {
      const body = await route.request().postDataJSON().catch(() => ({}))
      const agentId: string = body?.agentId ?? 'pm-agent'

      let content = ''
      if (agentId === 'pm-agent') {
        content = '需求已分析完毕。任务：实现一个登录页面。'
      } else if (agentId === 'dev-agent') {
        content = '代码已实现。```tsx\nfunction Login() { return <div>Login</div> }\n```'
      } else if (agentId === 'review-agent') {
        content = '代码审查通过，质量良好，建议添加单元测试。'
      } else {
        content = '响应完成。'
      }

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: makeSSEBody(content),
      })
    })
  })

  test('user message appears after sending', async ({ page }) => {
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder(/输入你的需求/i)
    await input.fill('帮我创建一个登录页面')

    await page.getByRole('button', { name: /发送/i }).click()

    // User message should be visible in the chat
    await expect(page.getByText('帮我创建一个登录页面')).toBeVisible({ timeout: 5000 })
  })
})
