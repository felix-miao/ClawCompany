/**
 * 简单测试：使用 sessions_spawn 测试 Agent 功能
 *
 * 运行方式: cd skill && npx jest --testPathPattern="root-agents-simple"
 *
 * 此文件也作为独立脚本使用。
 * 正式的 Jest 测试在 skill/tests/root-agents-simple.test.ts
 *
 * 注意：独立运行时需要 OpenClaw 环境 (sessions_spawn, sessions_history 全局可用)
 */

declare const sessions_spawn: (opts: {
  runtime?: string
  task: string
  thinking?: string
  mode?: string
  runTimeoutSeconds?: number
  agentId?: string
  cwd?: string
}) => Promise<string>

declare const sessions_history: (opts: {
  sessionKey: string
  limit?: number
}) => Promise<Array<{ status: string; content: string }>>

async function testPMAgent() {
  console.log('\nTest: PM Agent')
  console.log('='.repeat(60))

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
    const sessionKey = await sessions_spawn({
      runtime: 'subagent',
      task: task,
      thinking: 'high',
      mode: 'run',
      runTimeoutSeconds: 60,
    })

    console.log(`Session created: ${sessionKey}`)

    const result = await waitForAgentCompletion(sessionKey, 60000)
    console.log(`PM Agent completed`)
    console.log(`Result: ${result.substring(0, 200)}...`)

    return { success: true, result }
  } catch (error) {
    console.error(`PM Agent failed:`, error)
    return { success: false, error }
  }
}

async function testDevAgent() {
  console.log('\nTest: Dev Agent')
  console.log('='.repeat(60))

  const task = `你是 Dev Agent (开发者)。

任务：实现一个简单的计数器组件
描述：创建一个具有增加和减少功能的计数器

要求：
- 使用 TypeScript
- 提供基本功能

完成后，请说明你做了什么。`

  try {
    const sessionKey = await sessions_spawn({
      runtime: 'acp',
      agentId: 'opencode',
      task: task,
      mode: 'run',
      runTimeoutSeconds: 120,
      cwd: process.cwd(),
    })

    console.log(`Session created: ${sessionKey}`)

    const result = await waitForAgentCompletion(sessionKey, 120000)
    console.log(`Dev Agent completed`)
    console.log(`Result: ${result.substring(0, 200)}...`)

    return { success: true, result }
  } catch (error) {
    console.error(`Dev Agent failed:`, error)
    return { success: false, error }
  }
}

async function testReviewAgent() {
  console.log('\nTest: Review Agent')
  console.log('='.repeat(60))

  const task = `你是 Review Agent (代码审查)。

任务：审查计数器组件代码

审查清单：
- 代码风格
- TypeScript 类型安全
- 错误处理

请返回 JSON 格式：
{
  "approved": true,
  "issues": [],
  "suggestions": ["建议1"],
  "message": "审查总结"
}`

  try {
    const sessionKey = await sessions_spawn({
      runtime: 'subagent',
      task: task,
      thinking: 'high',
      mode: 'run',
      runTimeoutSeconds: 60,
    })

    console.log(`Session created: ${sessionKey}`)

    const result = await waitForAgentCompletion(sessionKey, 60000)
    console.log(`Review Agent completed`)
    console.log(`Result: ${result.substring(0, 200)}...`)

    return { success: true, result }
  } catch (error) {
    console.error(`Review Agent failed:`, error)
    return { success: false, error }
  }
}

async function waitForAgentCompletion(
  sessionKey: string,
  timeout: number,
): Promise<string> {
  const startTime = Date.now()
  const pollInterval = 2000

  while (Date.now() - startTime < timeout) {
    try {
      const history = await sessions_history({
        sessionKey,
        limit: 1,
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
      if (error instanceof Error && error.message.startsWith('Session failed')) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error('Wait for completion timeout')
}

async function main() {
  console.log('ClawCompany Agent Tests\n')
  console.log('='.repeat(60))

  const results = {
    pm: await testPMAgent(),
    dev: await testDevAgent(),
    review: await testReviewAgent(),
  }

  console.log('\n\n' + '='.repeat(60))
  console.log('Report')
  console.log('='.repeat(60))

  console.log(`PM Agent: ${results.pm.success ? 'PASS' : 'FAIL'}`)
  console.log(`Dev Agent: ${results.dev.success ? 'PASS' : 'FAIL'}`)
  console.log(`Review Agent: ${results.review.success ? 'PASS' : 'FAIL'}`)

  const allSuccess = results.pm.success && results.dev.success && results.review.success
  console.log(`\n${allSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`)

  return results
}

main()
  .then(() => {
    console.log('\n' + '='.repeat(60))
    console.log('Tests completed')
  })
  .catch((error) => {
    console.error('\nTests failed:', error)
  })
