import { PMAgent } from './agents/pm-agent'
import { DevAgent } from './agents/dev-agent'
import { ReviewAgent } from './agents/review-agent'
import {
  Task,
  PMResult,
  DevResult,
  ReviewResult,
  ExecutionResult,
  OrchestratorConfig,
} from './core/types'

export type { Task, PMResult, DevResult, ReviewResult, ReviewResult as ReviewAgentResult, ExecutionResult, OrchestratorConfig }

export interface WorkflowResult {
  success: boolean
  tasks: Task[]
  messages: Array<{
    agent: string
    content: string
    timestamp: string
  }>
}

export class ClawCompanyOrchestrator {
  private config: OrchestratorConfig
  private pmAgent: PMAgent
  private devAgent: DevAgent
  private reviewAgent: ReviewAgent

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      projectPath: process.cwd(),
      thinking: 'high',
      model: 'glm-5',
      ...config,
    }
    this.pmAgent = new PMAgent({ thinking: this.config.thinking, model: this.config.model })
    this.devAgent = new DevAgent({ thinking: this.config.thinking })
    this.reviewAgent = new ReviewAgent({ thinking: this.config.thinking })
  }

  async execute(userRequest: string, projectPath?: string): Promise<ExecutionResult> {
    const apiCheck = this.pmAgent['checkOpenClawAPI']()
    if (!apiCheck.available) {
      const errorMsg = `OpenClaw API 不可用: 缺少 ${apiCheck.missing.join(', ')}. ` +
        `请确保在 OpenClaw 环境中运行此代码。`
      console.error(`❌ ${errorMsg}`)
      return { success: false, tasks: [], results: [], summary: errorMsg }
    }

    const cwd = projectPath || this.config.projectPath || process.cwd()

    console.log('🦞 ClawCompany 开始处理...')
    console.log(`📁 项目路径: ${cwd}`)
    console.log(`📝 用户需求: ${userRequest}`)

    console.log('\n📋 PM Agent 分析需求...')
    const pmResult = await this.runPM(userRequest)

    if (!pmResult.tasks || pmResult.tasks.length === 0) {
      return { success: false, tasks: [], results: [], summary: 'PM Agent 未能生成有效任务' }
    }

    console.log(`✓ 拆分为 ${pmResult.tasks.length} 个任务`)

    const results: ExecutionResult['results'] = []

    for (const task of pmResult.tasks) {
      console.log(`\n💻 Dev Agent 执行任务: ${task.title}`)

      const devResult = await this.runDev(task, cwd)
      console.log(`✓ Dev Agent 完成`)

      console.log(`🔍 Review Agent 审查...`)
      const reviewResult = await this.runReview(task, devResult)

      if (reviewResult.approved) {
        console.log(`✓ 审查通过`)
      } else {
        console.log(`⚠ 审查发现问题: ${reviewResult.issues.join(', ')}`)
      }

      results.push({ task, files: devResult.files, review: reviewResult })
    }

    const summary = `完成了 ${pmResult.tasks.length} 个任务`
    console.log(`\n✅ ${summary}`)

    return { success: true, tasks: pmResult.tasks, results, summary }
  }

  private async runPM(userRequest: string): Promise<PMResult> {
    try {
      return await this.pmAgent.analyze(userRequest)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ PM Agent 启动失败:', {
        error: errorMsg,
        timestamp: new Date().toISOString(),
      })
      throw new Error(`PM Agent 启动失败: ${errorMsg}`)
    }
  }

  private async runDev(task: Task, projectPath: string): Promise<DevResult> {
    return await this.devAgent.execute(task, projectPath)
  }

  private async runReview(task: Task, devResult: DevResult): Promise<ReviewResult> {
    return await this.reviewAgent.review(task, devResult)
  }
}

export async function orchestrate(
  userRequest: string,
  projectPath?: string,
): Promise<WorkflowResult> {
  const orchestrator = new ClawCompanyOrchestrator({ projectPath })
  const messages: WorkflowResult['messages'] = []

  try {
    const pmResult = await orchestrator['runPM'](userRequest)
    messages.push({
      agent: 'pm',
      content: pmResult.analysis,
      timestamp: new Date().toISOString(),
    })

    if (!pmResult.tasks || pmResult.tasks.length === 0) {
      return { success: false, tasks: [], messages }
    }

    const cwd = projectPath || process.cwd()

    for (const task of pmResult.tasks) {
      task.status = 'in_progress'
      const devResult = await orchestrator['runDev'](task, cwd)
      messages.push({
        agent: 'dev',
        content: devResult.summary,
        timestamp: new Date().toISOString(),
      })

      const reviewResult = await orchestrator['runReview'](task, devResult)
      messages.push({
        agent: 'review',
        content: reviewResult.summary,
        timestamp: new Date().toISOString(),
      })

      task.status = reviewResult.approved ? 'done' : 'pending'
    }

    return { success: true, tasks: pmResult.tasks, messages }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    messages.push({
      agent: 'system',
      content: `Error: ${errorMsg}`,
      timestamp: new Date().toISOString(),
    })
    return { success: false, tasks: [], messages }
  }
}
