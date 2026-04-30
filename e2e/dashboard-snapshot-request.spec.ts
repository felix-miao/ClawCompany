import { expect, test } from '@playwright/test'

test('dashboard starts the OpenClaw snapshot stream in a real browser', async ({ page }) => {
  const seenRequests: string[] = []
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname
    if (pathname.startsWith('/api/openclaw/snapshot')) {
      seenRequests.push(pathname)
    }
  })

  const snapshotRequest = page.waitForRequest(request => {
    const url = new URL(request.url())
    return url.pathname === '/api/openclaw/snapshot/stream'
      || url.pathname === '/api/openclaw/snapshot'
  }, { timeout: 10_000 })

  await page.goto('http://127.0.0.1:3000/dashboard')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const request = await snapshotRequest
  expect(new URL(request.url()).pathname).toMatch(/^\/api\/openclaw\/snapshot(?:\/stream)?$/)

  await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('OpenClaw: Live')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('No agents reported')).not.toBeVisible()
  expect(seenRequests).toContain('/api/openclaw/snapshot/stream')
})
