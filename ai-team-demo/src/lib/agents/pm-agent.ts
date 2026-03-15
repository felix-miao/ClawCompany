// PM Agent - 产品经理 Agent

import { BaseAgent } from './base'
import { Task, AgentResponse, AgentContext } from './types'

export class PMAgent extends BaseAgent {
  constructor() {
    super(
      'pm-agent-1',
      'PM Agent',
      'pm',
      '负责需求分析、任务拆分和团队协调'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`分析任务: ${task.title}`)

    // PM Agent 的核心逻辑：
    // 1. 理解用户需求
    // 2. 拆分成可执行的子任务
    // 3. 分配给合适的 Agent

    const response = await this.analyzeAndPlan(task, context)

    return response
  }

  private async analyzeAndPlan(task: Task, context: AgentContext): Promise<AgentResponse> {
    // 模拟 PM Agent 的分析和规划逻辑
    const keywords = this.extractKeywords(task.description)
    
    // 根据关键词生成子任务
    const subTasks = this.generateSubTasks(task, keywords)

    return {
      agent: 'pm',
      message: this.generatePlanningMessage(task, subTasks),
      tasks: subTasks,
      nextAgent: 'dev',
      status: 'success'
    }
  }

  private extractKeywords(description: string): string[] {
    const keywords: string[] = []
    
    if (description.includes('登录') || description.includes('login')) {
      keywords.push('auth', 'form', 'validation')
    }
    if (description.includes('表单') || description.includes('form') || description.includes('注册')) {
      keywords.push('form', 'validation')
    }
    if (description.includes('页面') || description.includes('page')) {
      keywords.push('ui', 'component', 'styling')
    }
    if (description.includes('API') || description.includes('接口')) {
      keywords.push('api', 'backend', 'database')
    }
    if (description.includes('测试') || description.includes('test')) {
      keywords.push('testing', 'quality')
    }

    return keywords.length > 0 ? keywords : ['implementation', 'testing']
  }

  private generateSubTasks(
    parentTask: Task,
    keywords: string[]
  ): Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[] {
    const tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[] = []

    if (keywords.includes('form')) {
      tasks.push({
        title: '创建表单组件',
        description: `为 ${parentTask.title} 创建表单 UI 组件`,
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: []
      })
    }

    if (keywords.includes('validation')) {
      tasks.push({
        title: '添加表单验证',
        description: '实现表单输入验证逻辑',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: ['创建表单组件'],
        files: []
      })
    }

    if (keywords.includes('api')) {
      tasks.push({
        title: '实现 API 接口',
        description: '创建后端 API 端点',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: []
      })
    }

    if (keywords.includes('testing')) {
      tasks.push({
        title: '编写测试用例',
        description: '为功能添加单元测试',
        status: 'pending',
        assignedTo: 'dev',
        dependencies: ['创建表单组件', '实现 API 接口'],
        files: []
      })
    }

    // 默认任务
    if (tasks.length === 0) {
      tasks.push({
        title: `实现 ${parentTask.title}`,
        description: parentTask.description,
        status: 'pending',
        assignedTo: 'dev',
        dependencies: [],
        files: []
      })
    }

    return tasks
  }

  private generatePlanningMessage(
    task: Task,
    subTasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]
  ): string {
    let message = `好的！我已经分析了需求 "${task.title}"。\n\n`
    message += `我将其拆分为以下 ${subTasks.length} 个子任务：\n\n`
    
    subTasks.forEach((t, i) => {
      message += `${i + 1}. **${t.title}**\n`
      message += `   - 负责人: ${t.assignedTo === 'dev' ? 'Dev Agent' : 'Review Agent'}\n`
      message += `   - 状态: 待开始\n`
      if (t.dependencies.length > 0) {
        message += `   - 依赖: ${t.dependencies.join(', ')}\n`
      }
      message += '\n'
    })

    message += `Dev Agent，请开始实现第一个任务：**${subTasks[0]?.title || '待定'}**`

    return message
  }
}
