// Agent 基础类

import { AgentRole, Task, AgentResponse, AgentContext } from './types'

export abstract class BaseAgent {
  id: string
  name: string
  role: AgentRole
  description: string

  constructor(id: string, name: string, role: AgentRole, description: string) {
    this.id = id
    this.name = name
    this.role = role
    this.description = description
  }

  abstract execute(task: Task, context: AgentContext): Promise<AgentResponse>

  protected generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`)
  }
}
