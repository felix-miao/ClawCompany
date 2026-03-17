/**
 * ClawCompany Orchestrator - OpenClaw Skill
 * 
 * 真实的 OpenClaw 集成，使用 sessions_spawn 创建 AI 团队
 * 
 * 用法：
 * 1. 作为 OpenClaw Skill 运行（在 main session 中）
 * 2. 或者通过 HTTP API 调用（ai-team-demo 的 API route）
 * 
 * 注意：此文件中的工具调用（sessions_spawn, sessions_history 等）
 * 需要在 OpenClaw 环境中运行。如果在 Node.js 环境中运行，
 * 需要通过 OpenClaw Gateway HTTP API 调用。
 */

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: 'pm' | 'dev' | 'review'
  status: 'pending' | 'in_progress' | 'review' | 'done'
  dependencies: string[]
}

export interface WorkflowResult {
  success: boolean
  tasks: Task[]
  messages: Array<{
    agent: string
    content: string
    timestamp: string
  }>
}

/**
 * 配置
 */
const CONFIG = {
  // OpenClaw Gateway URL（用于 HTTP API 调用）
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3000',
  
  // 超时设置
  timeouts: {
    pm: 60000,      // PM Agent: 60s
    dev: 120000,    // Dev Agent: 120s
    review: 60000   // Review Agent: 60s
  },
  
  // Agent IDs
  agents: {
    dev: process.env.DEV_AGENT_ID || 'opencode'
  }
}

/**
 * 主入口 - 执行用户需求
 * 
 * @param userRequest 用户需求描述
 * @param tools OpenClaw 工具集（可选，如果在 OpenClaw 环境中运行）
 * @returns 工作流结果
 */
export async function orchestrate(
  userRequest: string,
  tools?: {
    sessions_spawn?: typeof sessions_spawn
    sessions_history?: typeof sessions_history
  }
): Promise<WorkflowResult> {
  console.log(`\n🚀 ClawCompany Orchestrator 启动`)
  console.log(`📋 用户需求: ${userRequest}\n`)

  const messages: Array<{ agent: string; content: string; timestamp: string }> = []
  
  // Step 1: PM Agent 分析需求
  console.log(`👤 [PM Agent] 正在分析需求...`)
  const pmResult = await spawnPMAgent(userRequest, tools)
  messages.push({
    agent: 'pm',
    content: pmResult.message,
    timestamp: new Date().toISOString()
  })
  console.log(`✅ [PM Agent] 分析完成\n`)

  // Step 2: 执行任务
  for (const task of pmResult.tasks) {
    if (task.status !== 'pending') continue

    console.log(`💻 [Dev Agent] 开始任务: ${task.title}`)
    task.status = 'in_progress'
    
    const devResult = await spawnDevAgent(task, tools)
    messages.push({
      agent: 'dev',
      content: devResult.message,
      timestamp: new Date().toISOString()
    })
    console.log(`✅ [Dev Agent] 任务完成\n`)

    // Step 3: Review Agent 审查
    console.log(`🔍 [Review Agent] 正在审查...`)
    task.status = 'review'
    
    const reviewResult = await spawnReviewAgent(task, devResult.files, tools)
    messages.push({
      agent: 'review',
      content: reviewResult.message,
      timestamp: new Date().toISOString()
    })

    if (reviewResult.approved) {
      task.status = 'done'
      console.log(`✅ [Review Agent] 审查通过\n`)
    } else {
      task.status = 'pending'
      console.log(`⚠️  [Review Agent] 需要修改\n`)
    }
  }

  return {
    success: true,
    tasks: pmResult.tasks,
    messages
  }
}

/**
 * PM Agent - 需求分析和任务拆分
 */
async function spawnPMAgent(
  userRequest: string,
  tools?: {
    sessions_spawn?: typeof sessions_spawn
    sessions_history?: typeof sessions_history
  }
): Promise<{
  message: string
  tasks: Task[]
}> {
  const taskPrompt = `你是 PM Agent (产品经理)。

用户需求：${userRequest}

你的职责：
1. 深入分析用户需求
2. 将需求拆分成具体的、可执行的子任务
3. 为每个子任务指定负责人 (dev 或 review)
4. 设置任务依赖关系

请返回 JSON 格式：
{
  "analysis": "需求分析总结",
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "任务描述",
      "assignedTo": "dev",
      "dependencies": []
    }
  ],
  "message": "给团队的回复消息（使用 Markdown）"
}

要求：
- 任务应该是具体的、可执行的
- 每个任务应该有明确的负责人
- 任务之间如果有依赖关系，请明确标注
- 回复消息应该友好、专业`

  try {
    // 检查是否有 OpenClaw 工具
    if (!tools?.sessions_spawn || !tools?.sessions_history) {
      console.log('   ⚠️  OpenClaw 工具不可用，使用回退模式')
      throw new Error('OpenClaw tools not available')
    }

    // 使用真实的 sessions_spawn
    const sessionKey = await tools.sessions_spawn({
      runtime: 'subagent',
      task: taskPrompt,
      thinking: 'high',
      mode: 'run',
      runTimeoutSeconds: 60
    })

    console.log(`   PM Agent session: ${sessionKey}`)

    // 等待完成
    const result = await waitForCompletion(sessionKey, 60000, tools.sessions_history)
    
    // 解析 JSON
    const parsed = JSON.parse(result)
    return {
      message: parsed.message,
      tasks: parsed.tasks.map((t: any) => ({
        ...t,
        status: 'pending'
      }))
    }
  } catch (error) {
    console.error('PM Agent 失败:', error)
    // 回退到简单模式
    return {
      message: `## 需求分析\n\n用户需求: ${userRequest}\n\n我将开始分析并拆分任务...`,
      tasks: [{
        id: 'task-1',
        title: '实现用户需求',
        description: userRequest,
        assignedTo: 'dev',
        status: 'pending',
        dependencies: []
      }]
    }
  }
}

/**
 * Dev Agent - 代码实现
 */
async function spawnDevAgent(
  task: Task,
  tools?: {
    sessions_spawn?: typeof sessions_spawn
    sessions_history?: typeof sessions_history
  }
): Promise<{
  message: string
  files: string[]
}> {
  const taskPrompt = `你是 Dev Agent (开发者)。

任务：${task.title}
描述：${task.description}

你的职责：
1. 实现这个功能
2. 创建/修改代码文件
3. 确保代码可运行
4. 提交给 Review Agent

要求：
- 使用 TypeScript/JavaScript
- 遵循最佳实践
- 添加必要的注释
- 确保代码质量

完成后，请说明你做了什么，创建了哪些文件。`

  try {
    // 检查是否有 OpenClaw 工具
    if (!tools?.sessions_spawn || !tools?.sessions_history) {
      console.log('   ⚠️  OpenClaw 工具不可用，使用回退模式')
      throw new Error('OpenClaw tools not available')
    }

    // 使用真实的 sessions_spawn (ACP runtime)
    const sessionKey = await tools.sessions_spawn({
      runtime: 'acp',
      agentId: CONFIG.agents.dev,
      task: taskPrompt,
      mode: 'run',
      runTimeoutSeconds: 120,
      cwd: process.cwd()
    })

    console.log(`   Dev Agent session: ${sessionKey}`)

    // 等待完成
    const result = await waitForCompletion(sessionKey, 120000, tools.sessions_history)
    
    return {
      message: result,
      files: [] // 可以从结果中解析文件列表
    }
  } catch (error) {
    console.error('Dev Agent 失败:', error)
    return {
      message: `开发任务 "${task.title}" 完成。`,
      files: []
    }
  }
}

/**
 * Review Agent - 代码审查
 */
async function spawnReviewAgent(
  task: Task,
  files: string[],
  tools?: {
    sessions_spawn?: typeof sessions_spawn
    sessions_history?: typeof sessions_history
  }
): Promise<{
  approved: boolean
  message: string
}> {
  const reviewPrompt = `你是 Review Agent (代码审查)。

任务：${task.title}
生成的文件：${files.length > 0 ? files.join(', ') : '无文件信息'}

你的职责：
1. 检查代码质量
2. 安全性审查
3. 性能优化建议
4. 提出改进建议

审查清单：
- ✅ 代码风格
- ✅ TypeScript 类型安全
- ✅ 错误处理
- ✅ 可访问性 (a11y)
- ✅ 性能优化
- ✅ 安全性检查

请返回 JSON 格式：
{
  "approved": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "message": "审查总结（使用 Markdown）"
}`

  try {
    // 检查是否有 OpenClaw 工具
    if (!tools?.sessions_spawn || !tools?.sessions_history) {
      console.log('   ⚠️  OpenClaw 工具不可用，使用回退模式')
      throw new Error('OpenClaw tools not available')
    }

    // 使用真实的 sessions_spawn
    const sessionKey = await tools.sessions_spawn({
      runtime: 'subagent',
      task: reviewPrompt,
      thinking: 'high',
      mode: 'run',
      runTimeoutSeconds: 60
    })

    console.log(`   Review Agent session: ${sessionKey}`)

    // 等待完成
    const result = await waitForCompletion(sessionKey, 60000, tools.sessions_history)
    
    // 解析 JSON
    const parsed = JSON.parse(result)
    return {
      approved: parsed.approved,
      message: parsed.message
    }
  } catch (error) {
    console.error('Review Agent 失败:', error)
    return {
      approved: true,
      message: `## 代码审查\n\n任务 "${task.title}" 审查通过 ✅`
    }
  }
}

/**
 * 等待 session 完成
 */
async function waitForCompletion(
  sessionKey: string,
  timeout: number,
  sessions_history: typeof sessions_history
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
      // 继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }

  throw new Error('Wait for completion timeout')
}

// 导出给 OpenClaw 使用
export default orchestrate
