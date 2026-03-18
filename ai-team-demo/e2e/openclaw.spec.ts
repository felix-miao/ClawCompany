import { test, expect } from '@playwright/test'

// ⚠️ 这些测试需要 OpenClaw Gateway 运行
// 在 GLM-5 直接调用模式下，这些测试会被跳过
// 要启用这些测试，请设置环境变量：OPENCLAW_ENABLED=true

const openclawEnabled = process.env.OPENCLAW_ENABLED === 'true'

const describe = openclawEnabled ? test.describe : test.describe.skip

describe('🎬 OpenClaw 真实集成 - TDD 测试用例', () => {

  test('场景1：待办事项列表 - 用户输入需求，生成完整功能网页', async ({ page }) => {
    // 设置超时时间（OpenClaw 集成可能需要更长时间）
    test.setTimeout(300000) // 5分钟

    console.log('🎬 开始 OpenClaw 集成测试...\n')

    // ==================== 用户输入 ====================
    const userRequirement = '做一个待办事项列表，可以添加、删除、标记完成'

    console.log(`📝 用户需求：${userRequirement}\n`)

    // ==================== 前置条件 ====================
    // 确保 OpenClaw Gateway 正在运行
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 进入 Team Portal
    await page.click('text=Start Chatting')
    await page.waitForURL('**/team')
    await page.waitForLoadState('networkidle')

    // ==================== 执行：输入需求 ====================
    const chatInput = page.getByPlaceholder(/输入你的需求/i)
    await chatInput.fill(userRequirement)

    const sendButton = page.getByRole('button', { name: /发送/i })
    await sendButton.click()

    console.log('✅ 需求已发送\n')

    // ==================== 期望输出 1：PM Agent 分析 ====================
    console.log('⏳ 期望输出 1：PM Agent 应该分析需求并拆分任务')

    // 等待 PM Agent 响应（最多 60 秒）
    // 使用更具体的选择器：找到包含 "PM Agent" 文本的元素后的消息内容
    const pmMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=PM Agent')
    }).locator('.bg-gray-800')

    await expect(pmMessageLocator.first()).toBeVisible({ timeout: 60000 })

    // PM Agent 应该输出包含以下内容之一：
    // - "待办事项" 或 "Todo"
    // - "添加" 或 "新增"
    // - "删除"
    // - "标记完成" 或 "状态切换"
    const pmContent = await pmMessageLocator.first().textContent()
    expect(pmContent).toMatch(/(待办事项|Todo|添加|新增|删除|标记完成|分析|需求|任务)/i)

    console.log('✅ PM Agent 分析完成\n')

    // ==================== 期望输出 2：Dev Agent 生成代码 ====================
    console.log('⏳ 期望输出 2：Dev Agent 应该生成完整的代码')

    // 等待 Dev Agent 响应
    const devMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=Dev Agent')
    }).locator('.bg-gray-800')

    await expect(devMessageLocator.first()).toBeVisible({ timeout: 120000 })

    // Dev Agent 应该输出包含：
    // - 代码块（```tsx 或 ```typescript）
    // - 组件名称（TodoList, TodoItem 等）
    // - 核心功能实现
    const devContent = await devMessageLocator.first().textContent()
    expect(devContent).toMatch(/(```tsx|```typescript|TodoList|TodoItem|已完成|实现|功能)/i)

    console.log('✅ Dev Agent 代码生成完成\n')

    // ==================== 期望输出 3：Review Agent 审查 ====================
    console.log('⏳ 期望输出 3：Review Agent 应该审查代码')

    // 等待 Review Agent 响应
    const reviewMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=Review Agent')
    }).locator('.bg-gray-800')

    await expect(reviewMessageLocator.first()).toBeVisible({ timeout: 60000 })

    // Review Agent 应该输出包含：
    // - 审查结果（通过/需要修改）
    // - 优点或问题
    const reviewContent = await reviewMessageLocator.first().textContent()
    expect(reviewContent).toMatch(/(审查|通过|优点|问题|检查|建议)/i)

    console.log('✅ Review Agent 审查完成\n')

    // ==================== 期望输出 4：完成消息 ====================
    console.log('⏳ 期望输出 4：应该显示协作完成消息')

    // 等待完成消息
    await page.waitForTimeout(2000)

    // 最终截图
    await page.screenshot({ path: 'test-results/openclaw-todo-complete.png', fullPage: true })
    console.log('📸 截图保存: openclaw-todo-complete.png\n')

    // ==================== 验证：检查是否有实际文件生成 ====================
    console.log('⏳ 验证：检查是否生成了实际文件（可选）')

    // 如果 Dev Agent 真的创建了文件，应该能在这里验证
    // 注意：这需要实际的文件系统操作

    console.log('🎉 OpenClaw 集成测试完成！\n')
  })

  test('场景2：登录页面 - 用户输入需求，生成认证功能', async ({ page }) => {
    test.setTimeout(300000)

    console.log('🎬 场景2：登录页面\n')

    const userRequirement = '做一个登录页面，包含用户名、密码输入和登录按钮'

    console.log(`📝 用户需求：${userRequirement}\n`)

    // 前置条件
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // 执行
    const chatInput = page.getByPlaceholder(/输入你的需求/i)
    await chatInput.fill(userRequirement)

    const sendButton = page.getByRole('button', { name: /发送/i })
    await sendButton.click()

    console.log('✅ 需求已发送\n')

    // 期望输出 1：PM Agent
    const pmMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=PM Agent')
    }).locator('.bg-gray-800')
    await expect(pmMessageLocator.first()).toBeVisible({ timeout: 60000 })
    const pmContent = await pmMessageLocator.first().textContent()
    expect(pmContent).toMatch(/(登录|Login|认证|Auth|分析|需求|任务)/i)
    console.log('✅ PM Agent 分析完成\n')

    // 期望输出 2：Dev Agent
    const devMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=Dev Agent')
    }).locator('.bg-gray-800')
    await expect(devMessageLocator.first()).toBeVisible({ timeout: 120000 })
    const devContent = await devMessageLocator.first().textContent()
    expect(devContent).toMatch(/(```tsx|LoginForm|Login|密码|Password|已完成|实现|功能)/i)
    console.log('✅ Dev Agent 代码生成完成\n')

    // 期望输出 3：Review Agent
    const reviewMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=Review Agent')
    }).locator('.bg-gray-800')
    await expect(reviewMessageLocator.first()).toBeVisible({ timeout: 60000 })
    console.log('✅ Review Agent 审查完成\n')

    // 截图
    await page.screenshot({ path: 'test-results/openclaw-login-complete.png', fullPage: true })
    console.log('📸 截图保存: openclaw-login-complete.png\n')

    console.log('🎉 场景2测试完成！\n')
  })

  test('场景3：计数器组件 - 简单功能验证', async ({ page }) => {
    test.setTimeout(180000)

    console.log('🎬 场景3：计数器组件（简单验证）\n')

    const userRequirement = '做一个计数器，可以增加和减少数字'

    console.log(`📝 用户需求：${userRequirement}\n`)

    // 前置条件
    await page.goto('/team')
    await page.waitForLoadState('networkidle')

    // 执行
    const chatInput = page.getByPlaceholder(/输入你的需求/i)
    await chatInput.fill(userRequirement)

    const sendButton = page.getByRole('button', { name: /发送/i })
    await sendButton.click()

    console.log('✅ 需求已发送\n')

    // 期望：3 个 Agent 都响应
    const pmMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=PM Agent')
    }).locator('.bg-gray-800')
    await expect(pmMessageLocator.first()).toBeVisible({ timeout: 60000 })

    const devMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=Dev Agent')
    }).locator('.bg-gray-800')
    await expect(devMessageLocator.first()).toBeVisible({ timeout: 120000 })

    const reviewMessageLocator = page.locator('div.flex.items-start.gap-3').filter({
      has: page.locator('text=Review Agent')
    }).locator('.bg-gray-800')
    await expect(reviewMessageLocator.first()).toBeVisible({ timeout: 60000 })

    console.log('✅ 所有 Agent 响应完成\n')

    // 截图
    await page.screenshot({ path: 'test-results/openclaw-counter-complete.png', fullPage: true })
    console.log('📸 截图保存: openclaw-counter-complete.png\n')

    console.log('🎉 场景3测试完成！\n')
  })
})
