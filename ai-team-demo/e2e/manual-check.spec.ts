import { test } from '@playwright/test'

test('手动检查 Demo - 请在浏览器中操作', async ({ page }) => {
  // 打开 Landing Page
  await page.goto('http://localhost:3000')
  
  console.log('✅ Landing Page 已打开')
  console.log('📝 请在浏览器中检查：')
  console.log('   1. 标题是否显示正常')
  console.log('   2. 3个 Agent 卡片是否显示')
  console.log('   3. 点击 "Start Chatting" 按钮')
  console.log('   4. 输入需求测试完整流程')
  
  // 保持浏览器打开 10 分钟供手动测试
  await page.waitForTimeout(600000)
})
