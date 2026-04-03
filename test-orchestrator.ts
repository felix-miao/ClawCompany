/**
 * 测试 ClawCompany Orchestrator
 *
 * 运行方式: cd skill && npx jest --testPathPattern="root-orchestrator"
 *
 * 此文件也作为独立脚本使用，通过 Orchestrator 类直接测试。
 * 正式的 Jest 测试在 skill/tests/root-orchestrator.test.ts
 */

import { orchestrate } from './skill/src/orchestrator'

async function main() {
  console.log('Test: ClawCompany Orchestrator\n')
  console.log('='.repeat(60))

  const userRequest = '创建一个计数器组件'
  console.log(`Request: ${userRequest}\n`)

  try {
    const result = await orchestrate(userRequest)

    console.log('\n' + '='.repeat(60))
    console.log('Result:\n')
    console.log(`Success: ${result.success}`)
    console.log(`Tasks: ${result.tasks.length}`)
    console.log(`Messages: ${result.messages.length}\n`)

    result.messages.forEach((msg, idx) => {
      console.log(`[${idx + 1}] ${msg.agent.toUpperCase()} Agent:`)
      console.log(`  Time: ${msg.timestamp}`)
      console.log(`  Content: ${msg.content.substring(0, 100)}...`)
    })

    console.log('\n\nTasks:')
    result.tasks.forEach(task => {
      console.log(`  - ${task.id}: ${task.title} (${task.status})`)
    })

    const hasPM = result.messages.some(m => m.agent === 'pm')
    const hasDev = result.messages.some(m => m.agent === 'dev')
    const hasReview = result.messages.some(m => m.agent === 'review')

    console.log('\n' + '='.repeat(60))
    console.log(`${hasPM ? 'PASS' : 'FAIL'} PM Agent`)
    console.log(`${hasDev ? 'PASS' : 'FAIL'} Dev Agent`)
    console.log(`${hasReview ? 'PASS' : 'FAIL'} Review Agent`)

    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
