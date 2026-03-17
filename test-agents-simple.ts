/**
 * 简单测试：使用 sessions_spawn 测试 Agent 功能
 * 
 * 这个测试直接使用 OpenClaw 的 sessions_spawn 工具
 * 来验证 PM、Dev、Review Agent 的基本功能
 */

// 测试 1: PM Agent
async function testPMAgent() {
  console.log('\n🧪 测试 PM Agent')
  console.log('=' .repeat(60))
  
  const task = `你是 PM Agent (产品经理)。

用户需求：创建一个计数器组件

你的职责：
1. 深入分析用户需求
2. 将需求拆分成具体的、可执行的子任务

请返回 JSON 格式：
{
  "analysis": "需求分析总结",
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "任务描述",
      "assignedTo": "dev"
    }
  ]
}`

  try {
    // 使用 sessions_spawn 创建 PM Agent
    const sessionKey = await sessions_spawn({
      runtime: 'subagent',
      task: task,
      thinking: 'high',
      mode: 'run',
      runTimeoutSeconds: 60
    })
    
    console.log(`✅ PM Agent session 已创建: ${sessionKey}`)
    
    // 等待完成并获取结果
    const result = await waitForAgentCompletion(sessionKey, 60000)
    console.log(`✅ PM Agent 完成`)
    console.log(`结果: ${result.substring(0, 200)}...`)
    
    return { success: true, result }
  } catch (error) {
    console.error(`❌ PM Agent 失败:`, error)
    return { success: false, error }
  }
}

// 测试 2: Dev Agent
async function testDevAgent() {
  console.log('\n🧪 测试 Dev Agent')
  console.log('=' .repeat(60))
  
  const task = `你是 Dev Agent (开发者)。

任务：实现一个简单的计数器组件
描述：创建一个具有增加和减少功能的计数器

要求：
- 使用 TypeScript
- 提供基本功能

完成后，请说明你做了什么。`

  try {
    // 使用 sessions_spawn 创建 Dev Agent
    const sessionKey = await sessions_spawn({
      runtime: 'acp',
      agentId: 'opencode',
      task: task,
      mode: 'run',
      runTimeoutSeconds: 120,
      cwd: process.cwd()
    })
    
    console.log(`✅ Dev Agent session 已创建: ${sessionKey}`)
    
    // 等待完成并获取结果
    const result = await waitForAgentCompletion(sessionKey, 120000)
    console.log(`✅ Dev Agent 完成`)
    console.log(`结果: ${result.substring(0, 200)}...`)
    
    return { success: true, result }
  } catch (error) {
    console.error(`❌ Dev Agent 失败:`, error)
    return { success: false, error }
  }
}

// 测试 3: Review Agent
async function testReviewAgent() {
  console.log('\n🧪 测试 Review Agent')
  console.log('=' .repeat(60))
  
  const task = `你是 Review Agent (代码审查)。

任务：审查计数器组件代码

审查清单：
- ✅ 代码风格
- ✅ TypeScript 类型安全
- ✅ 错误处理

请返回 JSON 格式：
{
  "approved": true,
  "issues": [],
  "suggestions": ["建议1"],
  "message": "审查总结"
}`

  try {
    // 使用 sessions_spawn 创建 Review Agent
    const sessionKey = await sessions_spawn({
      runtime: 'subagent',
      task: task,
      thinking: 'high',
      mode: 'run',
      runTimeoutSeconds: 60
    })
    
    console.log(`✅ Review Agent session 已创建: ${sessionKey}`)
    
    // 等待完成并获取结果
    const result = await waitForAgentCompletion(sessionKey, 60000)
    console.log(`✅ Review Agent 完成`)
    console.log(`结果: ${result.substring(0, 200)}...`)
    
    return { success: true, result }
  } catch (error) {
    console.error(`❌ Review Agent 失败:`, error)
    return { success: false, error }
  }
}

// 辅助函数：等待 agent 完成
async function waitForAgentCompletion(
  sessionKey: string,
  timeout: number
): Promise<string> {
  const startTime = Date.now()
  const pollInterval = 2000

  while (Date.now() - startTime < timeout) {
    try {
      const history = await sessions_history({
        sessionKey,
        limit: 1
      })

      if (history && history.length > 0) {
        const lastMessage = history[0]
        
        if (lastMessage.status === 'completed') {
          return lastMessage.content
        }
        
        if (lastMessage.status === 'failed') {
          throw new Error(`Session failed: ${lastMessage.content}`)
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error('Wait for completion timeout')
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始测试 ClawCompany Agent 功能\n')
  console.log('测试需求: 创建一个计数器组件')
  console.log('=' .repeat(60))
  
  const results = {
    pm: await testPMAgent(),
    dev: await testDevAgent(),
    review: await testReviewAgent()
  }
  
  // 输出测试报告
  console.log('\n\n' + '=' .repeat(60))
  console.log('📊 测试报告')
  console.log('=' .repeat(60))
  
  console.log(`\n✓ PM Agent: ${results.pm.success ? '✅ 成功' : '❌ 失败'}`)
  console.log(`✓ Dev Agent: ${results.dev.success ? '✅ 成功' : '❌ 失败'}`)
  console.log(`✓ Review Agent: ${results.review.success ? '✅ 成功' : '❌ 失败'}`)
  
  const allSuccess = results.pm.success && results.dev.success && results.review.success
  console.log(`\n${allSuccess ? '✅ 所有测试通过' : '❌ 部分测试失败'}`)
  
  return results
}

// 运行测试
runTests()
  .then(() => {
    console.log('\n' + '=' .repeat(60))
    console.log('✅ 测试完成')
  })
  .catch((error) => {
    console.error('\n❌ 测试失败:', error)
  })
