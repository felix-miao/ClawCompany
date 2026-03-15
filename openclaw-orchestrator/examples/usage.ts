/**
 * Example: Using OpenClaw Orchestrator
 * 
 * This example shows how OpenClaw would coordinate AI agents
 * to complete a user request.
 */

import { OpenClawOrchestrator } from '../orchestrator'

// Example 1: Simple feature request
async function example1() {
  const orchestrator = new OpenClawOrchestrator('/Users/felixmiao/Projects/ClawCompany')
  
  const result = await orchestrator.executeRequest(
    '创建一个用户登录页面，包括表单验证和 API 接口'
  )

  console.log('Workflow Result:')
  console.log('- Success:', result.success)
  console.log('- Tasks:', result.tasks.length)
  console.log('- Files generated:', result.files.length)
  console.log('\nMessages:')
  result.messages.forEach(msg => {
    console.log(`[${msg.agent}] ${msg.content}`)
  })
}

// Example 2: Multiple features
async function example2() {
  const orchestrator = new OpenClawOrchestrator('/path/to/project')
  
  const result = await orchestrator.executeRequest(`
    我需要开发一个博客系统，包括：
    1. 文章列表页面
    2. 文章详情页面
    3. 评论功能
    4. 用户认证
  `)

  console.log('Blog System Development:')
  result.tasks.forEach(task => {
    console.log(`- ${task.title} (${task.status})`)
  })
}

// Example 3: Check status during execution
async function example3() {
  const orchestrator = new OpenClawOrchestrator('/path/to/project')
  
  // Start execution (non-blocking)
  const executionPromise = orchestrator.executeRequest('创建一个联系表单')

  // Check status periodically
  const statusInterval = setInterval(() => {
    const status = orchestrator.getStatus()
    console.log(`Progress: ${status.stats.done}/${status.stats.total} tasks completed`)
    
    if (status.stats.pending === 0 && status.stats.inProgress === 0) {
      clearInterval(statusInterval)
    }
  }, 5000)

  // Wait for completion
  const result = await executionPromise
  clearInterval(statusInterval)

  console.log('Final result:', result)
}

/**
 * How this integrates with OpenClaw:
 * 
 * 1. User sends a message to OpenClaw: "帮我创建一个登录页面"
 * 2. OpenClaw recognizes this as a development task
 * 3. OpenClaw creates an Orchestrator instance
 * 4. Orchestrator spawns PM Agent (using sessions_spawn with runtime: "subagent")
 * 5. PM Agent analyzes the request and creates task breakdown
 * 6. For each task:
 *    - Orchestrator spawns Dev Agent (using sessions_spawn with runtime: "acp", agentId: "opencode")
 *    - Dev Agent (real OpenCode) writes actual code
 *    - Orchestrator spawns Review Agent (using sessions_spawn with runtime: "subagent")
 *    - Review Agent checks the code quality
 * 7. OpenClaw returns the result to the user with generated files
 * 
 * The key difference from the demo:
 * - Demo: Simulated agents with pre-written responses
 * - Real: Actual AI agents spawned by OpenClaw, real code generation
 */

// Run example
if (require.main === module) {
  example1().catch(console.error)
}
