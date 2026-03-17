/**
 * 测试 ClawCompany Orchestrator
 * 
 * 测试目标：
 * 1. 验证 PM Agent 能否正确分析需求
 * 2. 验证 Dev Agent 能否生成代码
 * 3. 验证 Review Agent 能否完成审查
 * 4. 检查整个工作流是否正常
 */

import { orchestrate, WorkflowResult } from '../Projects/ClawCompany/skill/orchestrator'

// 测试用例：创建一个计数器组件
async function testOrchestrator() {
  console.log('🧪 开始测试 Orchestrator\n')
  console.log('=' .repeat(60))
  
  const userRequest = '创建一个计数器组件'
  console.log(`📋 测试需求: ${userRequest}\n`)

  try {
    // 调用 orchestrate 函数
    // 注意：在真实的 OpenClaw 环境中，sessions_spawn 和 sessions_history 会自动注入
    const result: WorkflowResult = await orchestrate(userRequest)
    
    console.log('\n' + '=' .repeat(60))
    console.log('📊 测试结果\n')
    
    // 检查是否成功
    console.log(`✅ 整体状态: ${result.success ? '成功' : '失败'}`)
    console.log(`📝 任务数量: ${result.tasks.length}`)
    console.log(`💬 消息数量: ${result.messages.length}\n`)
    
    // 检查 Agent 消息
    console.log('Agent 消息:')
    result.messages.forEach((msg, idx) => {
      console.log(`\n[${idx + 1}] ${msg.agent.toUpperCase()} Agent:`)
      console.log(`时间: ${msg.timestamp}`)
      console.log(`内容: ${msg.content.substring(0, 100)}...`)
    })
    
    // 检查任务状态
    console.log('\n\n任务状态:')
    result.tasks.forEach(task => {
      console.log(`  - ${task.id}: ${task.title} (${task.status})`)
    })
    
    // 验证测试结果
    console.log('\n' + '=' .repeat(60))
    console.log('✓ 测试验证:\n')
    
    const hasPM = result.messages.some(m => m.agent === 'pm')
    const hasDev = result.messages.some(m => m.agent === 'dev')
    const hasReview = result.messages.some(m => m.agent === 'review')
    
    console.log(`${hasPM ? '✅' : '❌'} PM Agent: ${hasPM ? '已调用' : '未调用'}`)
    console.log(`${hasDev ? '✅' : '❌'} Dev Agent: ${hasDev ? '已调用' : '未调用'}`)
    console.log(`${hasReview ? '✅' : '❌'} Review Agent: ${hasReview ? '已调用' : '未调用'}`)
    
    // 检查内容质量
    const pmMessage = result.messages.find(m => m.agent === 'pm')
    if (pmMessage) {
      const hasAnalysis = pmMessage.content.includes('需求') || pmMessage.content.includes('分析')
      console.log(`${hasAnalysis ? '✅' : '⚠️'}  PM Agent 分析: ${hasAnalysis ? '包含需求分析' : '可能缺少需求分析'}`)
    }
    
    const devMessage = result.messages.find(m => m.agent === 'dev')
    if (devMessage) {
      const hasCode = devMessage.content.includes('代码') || devMessage.content.includes('实现')
      console.log(`${hasCode ? '✅' : '⚠️'}  Dev Agent 代码: ${hasCode ? '包含代码实现' : '可能缺少代码实现'}`)
    }
    
    const reviewMessage = result.messages.find(m => m.agent === 'review')
    if (reviewMessage) {
      const hasReview = reviewMessage.content.includes('审查') || reviewMessage.content.includes('通过')
      console.log(`${hasReview ? '✅' : '⚠️'}  Review Agent 审查: ${hasReview ? '包含审查内容' : '可能缺少审查内容'}`)
    }
    
    return result
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    throw error
  }
}

// 运行测试
testOrchestrator()
  .then(() => {
    console.log('\n' + '=' .repeat(60))
    console.log('✅ 测试完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })
