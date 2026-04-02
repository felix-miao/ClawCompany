import { AgentRole, Task, AgentResponse, AgentContext } from './types'
import { generateId } from '../utils/id'

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
    return generateId('task_')
  }

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`)
  }
}
