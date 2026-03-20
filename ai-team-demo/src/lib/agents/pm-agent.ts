// PM Claw - 产品经理 Agent

import { BaseAgent } from './base'
import { Task, AgentResponse, AgentContext } from './types'
import { getLLMProvider } from '../llm/factory'

export class PMAgent extends BaseAgent {
  constructor() {
    super(
      'pm-agent-1',
      'PM Claw',
      'pm',
      '负责需求分析、任务拆分和团队协调'
    )
  }

  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    this.log(`分析任务: ${task.title}`)

    // PM Claw 的核心逻辑：
    // 1. 理解用户需求
    // 2. 拆分成可执行的子任务
    // 3. 分配给合适的 Agent

    const llmProvider = getLLMProvider()
    
    if (llmProvider) {
      // 使用 LLM 进行智能分析
      const response = await this.analyzeWithLLM(task, context, llmProvider)
      return response
    } else {
      // 回退到规则系统
      const response = await this.analyzeAndPlan(task, context)
      return response
    }
  }

  private async analyzeWithLLM(
    task: Task,
    context: AgentContext,
    llmProvider: NonNullable<ReturnType<typeof getLLMProvider>>
  ): Promise<AgentResponse> {
    const systemPrompt = `你是一个经验丰富的产品经理（PM Claw）。你的职责是：
1. 分析用户需求，理解他们想要构建什么
2. 将需求拆分成具体的、可执行的子任务
3. 为每个子任务分配合适的 Agent（dev 或 review）

请用 JSON 格式回复，包含以下字段：
{
  "analysis": "需求分析总结",
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务描述",
      "assignedTo": "dev" | "review",
      "dependencies": []
    }
  ],
  "message": "给团队的回复消息（使用 Markdown 格式）"
}

重要：
- 任务应该是具体的、可执行的
- 每个任务应该有明确的负责人
- 如果任务之间有依赖关系，请在 dependencies 中注明
- 回复消息应该友好、专业`

    const userPrompt = `用户需求: ${task.title}
描述: ${task.description}

请分析这个需求并制定执行计划。`

    try {
      const response = await llmProvider.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])

      // 解析 LLM 响应
      const parsed = this.parseLLMResponse(response)
      
      return {
        agent: 'pm',
        message: parsed.message,
        tasks: parsed.tasks,
        nextAgent: 'dev',
        status: 'success'
      }
    } catch (error) {
      this.log(`LLM 调用失败，回退到规则系统: ${error}`)
      return this.analyzeAndPlan(task, context)
    }
  }

  private parseLLMResponse(response: string): {
    analysis: string
    tasks: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>[]
    message: string
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        // 转换为标准格式
        const tasks = (parsed.tasks || []).map((t: any) => ({
          title: t.title || '未命名任务',
          description: t.description || '',
          status: 'pending' as const,
          assignedTo: t.assignedTo || 'dev',
          dependencies: t.dependencies || [],
          files: []
        }))

        return {
          analysis: parsed.analysis || '',
          tasks,
          message: parsed.message || '任务规划完成'
        }
      }
    } catch (e) {
      this.log(`解析 LLM 响应失败: ${e}`)
    }

    // 如果解析失败，使用整个响应作为消息
    return {
      analysis: '',
      tasks: [],
      message: response
    }
  }

  private async analyzeAndPlan(task: Task, context: AgentContext): Promise<AgentResponse> {
    // 模拟 PM Claw 的分析和规划逻辑
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
      message += `   - 负责人: ${t.assignedTo === 'dev' ? 'Dev Claw' : 'Reviewer Claw'}\n`
      message += `   - 状态: 待开始\n`
      if (t.dependencies.length > 0) {
        message += `   - 依赖: ${t.dependencies.join(', ')}\n`
      }
      message += '\n'
    })

    message += `Dev Claw，请开始实现第一个任务：**${subTasks[0]?.title || '待定'}**`

    return message
  }
}
