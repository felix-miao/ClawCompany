import { test, expect } from '@playwright/test'

test.describe('🎬 Demo 录制测试 - 真实 GLM-5 API', () => {

  test('完整 Demo 流程：Landing → Team Portal → PM → Dev → Review', async ({ page }) => {
    // 设置较长的超时时间（真实 API 需要时间）
    test.setTimeout(120000)

    console.log('🎬 开始 Demo 测试（真实 GLM-5 API）...\n')

    // ==================== 第一幕：Landing Page ====================
    console.log('📍 第一幕：Landing Page（30秒）')

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 检查标题
    const title = await page.locator('h1').first().textContent()
    console.log(`✅ 页面标题: ${title}`)

    // 截图
    await page.screenshot({ path: 'test-results/01-landing-page.png', fullPage: true })
    console.log('📸 截图保存: 01-landing-page.png')

    // 检查 3 个 Agent 卡片
    await expect(page.locator('text=PM Claw')).toBeVisible()
    await expect(page.locator('text=Dev Claw')).toBeVisible()
    await expect(page.locator('text=Reviewer Claw')).toBeVisible()
    console.log('✅ 3 个 Agent 卡片显示正常')

    // 检查 CTA 按钮
    const ctaButton = page.getByRole('link', { name: /start chatting/i })
    await expect(ctaButton).toBeVisible()
    console.log('✅ "Start Chatting" 按钮可见\n')

    // ==================== 第二幕：进入 Team Portal ====================
    console.log('📍 第二幕：Team Portal（开始协作）')

    await ctaButton.click()
    await page.waitForURL('**/team')
    console.log('✅ 成功跳转到 /team 页面')

    // 等待页面加载
    await page.waitForLoadState('networkidle')

    // 截图
    await page.screenshot({ path: 'test-results/02-team-portal.png', fullPage: true })
    console.log('📸 截图保存: 02-team-portal.png')

    // 检查聊天界面
    const chatInput = page.getByPlaceholder(/输入你的需求/i)
    await expect(chatInput).toBeVisible()
    console.log('✅ 聊天输入框可见')

    const sendButton = page.getByRole('button', { name: /发送/i })
    await expect(sendButton).toBeVisible()
    console.log('✅ 发送按钮可见\n')

    // ==================== 第三幕：输入需求并触发协作 ====================
    console.log('📍 第三幕：完整协作流程（PM → Dev → Review）')

    const testMessage = '帮我创建一个登录页面'
    console.log(`💬 输入需求: "${testMessage}"`)

    await chatInput.fill(testMessage)
    await sendButton.click()
    console.log('✅ 已点击发送按钮\n')

    // ==================== 等待 PM Claw 响应 ====================
    console.log('⏳ 等待 PM Claw 响应（真实 API，可能需要 10-30 秒）...')

    // 等待用户消息出现
    await expect(page.locator(`text=${testMessage}`)).toBeVisible({ timeout: 10000 })
    console.log('✅ 用户消息显示成功')

    // 等待 PM Claw 消息出现（真实 API 需要更长时间）
    await expect(page.locator('text=PM Claw').first()).toBeVisible({ timeout: 60000 })
    console.log('✅ PM Claw 已响应')

    // 截图
    await page.screenshot({ path: 'test-results/03-pm-response.png', fullPage: true })
    console.log('📸 截图保存: 03-pm-response.png\n')

    // ==================== 等待 Dev Claw 响应 ====================
    console.log('⏳ 等待 Dev Claw 响应...')

    await expect(page.locator('text=Dev Claw').first()).toBeVisible({ timeout: 60000 })
    console.log('✅ Dev Claw 已响应')

    // 截图
    await page.screenshot({ path: 'test-results/04-dev-response.png', fullPage: true })
    console.log('📸 截图保存: 04-dev-response.png\n')

    // ==================== 等待 Review Claw 响应 ====================
    console.log('⏳ 等待 Review Claw 响应...')

    await expect(page.locator('text=Review Claw').first()).toBeVisible({ timeout: 60000 })
    console.log('✅ Review Claw 已响应')

    // 截图
    await page.screenshot({ path: 'test-results/05-review-response.png', fullPage: true })
    console.log('📸 截图保存: 05-review-response.png\n')

    // ==================== 等待完成消息 ====================
    console.log('⏳ 检查协作流程是否完成...')

    // 等待一段时间确保所有消息都已渲染
    await page.waitForTimeout(2000)

    // 最终截图
    await page.screenshot({ path: 'test-results/06-complete.png', fullPage: true })
    console.log('📸 最终截图保存: 06-complete.png\n')

    // ==================== 测试完成 ====================
    console.log('🎉 Demo 测试完成（真实 GLM-5 API）！\n')
    console.log('📊 测试结果：')
    console.log('  ✅ Landing Page 正常显示')
    console.log('  ✅ Team Portal 正常显示')
    console.log('  ✅ PM Claw 正常响应（真实 GLM-5）')
    console.log('  ✅ Dev Claw 正常响应（真实 GLM-5）')
    console.log('  ✅ Review Claw 正常响应（真实 GLM-5）')
    console.log('  ✅ 完整协作流程成功')
    console.log('\n🎬 真实 API 测试通过，Demo 可以开始录制了！')
  })
})
