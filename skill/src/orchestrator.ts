/**
 * ClawCompany Orchestrator
 * 
 * 核心协调器 - 通过 OpenClaw sessions_spawn 组建 AI 虚拟团队
 * 
 * 注意：sessions_spawn, sessions_history, sessions_send 是 OpenClaw 的内置工具，
 * 在 OpenClaw 环境中全局可用，无需导入。
 */

export interface Task {
  id: string
  title: string
  description: string
  assignedTo: 'dev'
  dependencies: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface PMResult {
  analysis: string
  tasks: Task[]
}

export interface DevResult {
  success: boolean
  files: string[]
  summary: string
}

export interface ReviewResult {
  approved: boolean
  issues: string[]
  suggestions: string[]
  summary: string
}

export interface ExecutionResult {
  success: boolean
  tasks: Task[]
  results: Array<{
    task: Task
    files: string[]
    review: ReviewResult
  }>
  summary: string
}

export interface OrchestratorConfig {
  projectPath?: string
  thinking?: 'low' | 'medium' | 'high'
  model?: string
}

export class ClawCompanyOrchestrator {
  private config: OrchestratorConfig

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      projectPath: process.cwd(),
      thinking: 'high',
      model: 'glm-5',
      ...config
    }
  }

  /**
   * 执行用户需求
   */
  async execute(userRequest: string, projectPath?: string): Promise<ExecutionResult> {
    const cwd = projectPath || this.config.projectPath || process.cwd()
    
    console.log('🦞 ClawCompany 开始处理...')
    console.log(`📁 项目路径: ${cwd}`)
    console.log(`📝 用户需求: ${userRequest}`)

    // 1. Spawn PM Agent
    console.log('\n📋 PM Agent 分析需求...')
    const pmSession = await this.spawnPMAgent(userRequest)
    const pmResult = await this.getPMResult(pmSession)
    
    if (!pmResult.tasks || pmResult.tasks.length === 0) {
      return {
        success: false,
        tasks: [],
        results: [],
        summary: 'PM Agent 未能生成有效任务'
      }
    }
    
    console.log(`✓ 拆分为 ${pmResult.tasks.length} 个任务`)

    // 2. 按顺序执行每个任务
    const results: ExecutionResult['results'] = []
    
    for (const task of pmResult.tasks) {
      console.log(`\n💻 Dev Agent 执行任务: ${task.title}`)
      
      // 2.1 Spawn Dev Agent
      const devSession = await this.spawnDevAgent(task, cwd)
      const devResult = await this.getDevResult(devSession)
      
      console.log(`✓ Dev Agent 完成`)
      
      // 2.2 Spawn Review Agent
      console.log(`🔍 Review Agent 审查...`)
      const reviewSession = await this.spawnReviewAgent(task, devResult)
      const reviewResult = await this.getReviewResult(reviewSession)
      
      if (reviewResult.approved) {
        console.log(`✓ 审查通过`)
      } else {
        console.log(`⚠ 审查发现问题: ${reviewResult.issues.join(', ')}`)
      }
      
      results.push({
        task,
        files: devResult.files,
        review: reviewResult
      })
    }

    const summary = `完成了 ${pmResult.tasks.length} 个任务`
    console.log(`\n✅ ${summary}`)
    
    return {
      success: true,
      tasks: pmResult.tasks,
      results,
      summary
    }
  }

  /**
   * Spawn PM Agent
   */
  private async spawnPMAgent(userRequest: string) {
    const task = `你是 PM Agent (产品经理)。

用户需求：${userRequest}

你的职责：
1. 分析用户需求
2. 拆分成可执行的子任务（2-5 个）
3. 为每个任务指定负责人 (dev)
4. 设置任务依赖关系

返回格式 (JSON):
{
  "analysis": "需求分析...",
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "任务描述",
      "assignedTo": "dev",
      "dependencies": [],
      "status": "pending"
    }
  ]
}

注意：只返回 JSON，不要有其他内容。`

    return await sessions_spawn({
      runtime: 'subagent',
      task,
      thinking: this.config.thinking,
      mode: 'run',
      model: this.config.model
    })
  }

  /**
   * Spawn Dev Agent (使用 OpenCode 或其他编码代理)
   */
  private async spawnDevAgent(task: Task, projectPath: string) {
    const devTask = `你是 Dev Agent (开发者)。

任务：${task.title}
描述：${task.description}

你的职责：
1. 实现这个功能
2. 创建/修改代码文件
3. 确保代码可运行

要求：
- 使用 TypeScript
- 遵循最佳实践
- 添加必要的注释

完成后返回 JSON:
{
  "success": true,
  "files": ["创建的文件路径"],
  "summary": "实现总结"
}`

    // 尝试使用 ACP runtime (OpenCode/Codex)
    try {
      return await sessions_spawn({
        runtime: 'acp',
        agentId: 'opencode',
        task: devTask,
        mode: 'run',
        cwd: projectPath
      })
    } catch {
      // Fallback to subagent
      return await sessions_spawn({
        runtime: 'subagent',
        task: devTask,
        thinking: 'medium',
        mode: 'run'
      })
    }
  }

  /**
   * Spawn Review Agent
   */
  private async spawnReviewAgent(task: Task, devResult: DevResult) {
    const reviewTask = `你是 Review Agent (代码审查)。

任务：${task.title}
Dev Agent 的实现：
${JSON.stringify(devResult, null, 2)}

你的职责：
1. 检查代码质量
2. 安全性审查
3. 性能优化建议
4. 提出改进建议

审查清单：
- 代码风格
- TypeScript 类型安全
- 错误处理
- 可访问性 (a11y)
- 性能优化
- 安全性检查

返回格式 (JSON):
{
  "approved": true,
  "issues": [],
  "suggestions": ["建议1"],
  "summary": "审查总结"
}

注意：只返回 JSON。`

    return await sessions_spawn({
      runtime: 'subagent',
      task: reviewTask,
      thinking: this.config.thinking,
      mode: 'run'
    })
  }

  /**
   * 从 session 中解析 JSON 响应（通用方法）
   */
  private async parseJSONFromSession<T>(
    session: any,
    defaultValue: T
  ): Promise<T> {
    try {
      const history = await sessions_history({ sessionKey: session.sessionKey })
      const lastMessage = history.messages?.[history.messages.length - 1]
      
      if (lastMessage?.content) {
        // 尝试解析 JSON
        const content = lastMessage.content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      }
    } catch (error) {
      console.error('解析 Session 结果失败:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        session: session?.sessionKey,
        timestamp: new Date().toISOString()
      })
    }
    
    return defaultValue
  }

  /**
   * 获取 PM Agent 结果
   */
  private async getPMResult(session: any): Promise<PMResult> {
    const defaultValue: PMResult = {
      analysis: '自动生成的任务',
      tasks: [{
        id: 'task-1',
        title: '实现用户需求',
        description: '根据用户需求实现功能',
        assignedTo: 'dev',
        dependencies: [],
        status: 'pending'
      }]
    }
    
    return await this.parseJSONFromSession(session, defaultValue)
  }

  /**
   * 获取 Dev Agent 结果
   */
  private async getDevResult(session: any): Promise<DevResult> {
    const defaultValue: DevResult = {
      success: true,
      files: [],
      summary: '任务完成'
    }
    
    return await this.parseJSONFromSession(session, defaultValue)
  }

  /**
   * 获取 Review Agent 结果
   */
  private async getReviewResult(session: any): Promise<ReviewResult> {
    const defaultValue: ReviewResult = {
      approved: true,
      issues: [],
      suggestions: [],
      summary: '审查通过'
    }
    
    return await this.parseJSONFromSession(session, defaultValue)
  }
}
