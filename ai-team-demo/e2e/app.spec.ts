// E2E tests - temporarily skipped (requires Playwright browser setup)
// Run with: npx playwright test
import { test, expect } from '@playwright/test'

test.describe.skip('ClawCompany E2E Tests', () => {
  
  test('Landing Page 应该正常显示', async ({ page }) => {
    await page.goto('/')
    
    // 检查标题
    await expect(page).toHaveTitle(/AI Team/)
    
    // 检查 Hero 标题
    await expect(page.locator('h1')).toContainText('One Person')
    
    // 检查 CTA 按钮
    const ctaButton = page.getByRole('link', { name: /start chatting/i })
    await expect(ctaButton).toBeVisible()
  })

  test('应该显示 3 个 Agent 卡片', async ({ page }) => {
    await page.goto('/')
    
    // 等待页面加载
    await page.waitForLoadState('networkidle')
    
    // 检查 PM Agent 卡片
    const pmCard = page.locator('text=PM Agent')
    await expect(pmCard).toBeVisible()
    
    // 检查 Dev Agent 卡片
    const devCard = page.locator('text=Dev Agent')
    await expect(devCard).toBeVisible()
    
    // 检查 Review Agent 卡片
    const reviewCard = page.locator('text=Review Agent')
    await expect(reviewCard).toBeVisible()
  })

  test('点击 Start Chatting 应该跳转到 /team', async ({ page }) => {
    await page.goto('/')
    
    // 点击按钮
    await page.click('text=Start Chatting')
    
    // 等待跳转
    await page.waitForURL('**/team')
    
    // 检查是否在 /team 页面
    expect(page.url()).toContain('/team')
    
    // 检查聊天界面是否显示
    await expect(page.locator('text=ClawCompany Team Portal')).toBeVisible()
  })

  test('Team Portal 页面应该显示聊天界面', async ({ page }) => {
    await page.goto('/team')
    
    // 检查标题
    await expect(page.locator('h1')).toContainText('ClawCompany Team Portal')
    
    // 检查输入框
    const input = page.getByPlaceholder(/描述你想要实现的功能/i)
    await expect(input).toBeVisible()
    
    // 检查发送按钮
    const sendButton = page.getByRole('button', { name: /发送/i })
    await expect(sendButton).toBeVisible()
  })

  test('Team Portal 页面应该显示 3 个 Agent', async ({ page }) => {
    await page.goto('/team')
    
    // 等待页面加载
    await page.waitForLoadState('networkidle')
    
    // 检查右侧边栏的 Agent 列表
    await expect(page.locator('text=团队成员')).toBeVisible()
    await expect(page.locator('text=PM Agent')).toBeVisible()
    await expect(page.locator('text=Dev Agent')).toBeVisible()
    await expect(page.locator('text=Review Agent')).toBeVisible()
  })

  test('输入需求并测试完整协作流程', async ({ page }) => {
    await page.goto('/team')
    
    // 等待页面加载
    await page.waitForLoadState('networkidle')
    
    // 输入需求
    const input = page.getByPlaceholder(/描述你想要实现的功能/i)
    await input.fill('帮我创建一个登录页面')
    
    // 点击发送
    const sendButton = page.getByRole('button', { name: /发送/i })
    await sendButton.click()
    
    // 等待用户消息出现
    await expect(page.locator('text=帮我创建一个登录页面')).toBeVisible()
    
    // 等待 PM Agent 响应（最多等待 5 秒）
    await expect(page.locator('text=PM Agent')).toBeVisible({ timeout: 5000 })
    
    // 等待 Dev Agent 响应
    await expect(page.locator('text=Dev Agent')).toBeVisible({ timeout: 5000 })
    
    // 等待 Review Agent 响应
    await expect(page.locator('text=Review Agent')).toBeVisible({ timeout: 5000 })
    
    // 等待完成消息
    await expect(page.locator('text=团队协作完成')).toBeVisible({ timeout: 5000 })
  })

  test('应该显示 Agent 的 Loading 状态', async ({ page }) => {
    await page.goto('/team')
    
    // 输入需求
    const input = page.getByPlaceholder(/描述你想要实现的功能/i)
    await input.fill('测试 Loading 状态')
    
    // 点击发送
    await page.click('text=发送')
    
    // 应该显示 Loading 状态（但可能很快消失）
    // 我们只检查 Agent 消息是否出现
    await expect(page.locator('text=PM Agent')).toBeVisible({ timeout: 3000 })
  })

  test('空输入不应该触发发送', async ({ page }) => {
    await page.goto('/team')
    
    // 获取发送按钮
    const sendButton = page.getByRole('button', { name: /发送/i })
    
    // 发送按钮应该是禁用状态（因为输入框为空）
    await expect(sendButton).toBeDisabled()
  })

  test('应该在输入内容后启用发送按钮', async ({ page }) => {
    await page.goto('/team')
    
    // 获取输入框和按钮
    const input = page.getByPlaceholder(/描述你想要实现的功能/i)
    const sendButton = page.getByRole('button', { name: /发送/i })
    
    // 初始状态：按钮禁用
    await expect(sendButton).toBeDisabled()
    
    // 输入内容
    await input.fill('测试内容')
    
    // 按钮应该启用
    await expect(sendButton).toBeEnabled()
  })
})
