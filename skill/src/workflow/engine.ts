/**
 * Workflow Engine - 工作流引擎
 * 
 * 支持任务依赖图、并行执行、条件分支
 */

import { Task } from '../orchestrator'

/**
 * 工作流节点
 */
export interface WorkflowNode {
  id: string
  task: Task
  dependencies: string[]
  condition?: (context: WorkflowContext) => boolean
  onsuccess?: string // 下一个节点 ID
  onfailure?: string // 失败时跳转的节点 ID
  retryCount?: number
  retryDelay?: number // ms
}

/**
 * 工作流上下文
 */
export interface WorkflowContext {
  variables: Record<string, any>
  results: Map<string, any>
  errors: Map<string, Error>
}

/**
 * 工作流定义
 */
export interface Workflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  startNode: string
}

/**
 * 工作流执行结果
 */
export interface WorkflowResult {
  success: boolean
  completedNodes: string[]
  failedNodes: string[]
  skippedNodes: string[]
  context: WorkflowContext
  executionTime: number
}

/**
 * 任务执行器接口
 */
export interface TaskExecutor {
  execute(task: Task, context: WorkflowContext): Promise<any>
}

/**
 * 工作流引擎
 */
export class WorkflowEngine {
  private workflow: Workflow
  private executor: TaskExecutor
  private context: WorkflowContext
  private maxConcurrency: number

  constructor(
    workflow: Workflow,
    executor: TaskExecutor,
    options: { maxConcurrency?: number } = {}
  ) {
    this.workflow = workflow
    this.executor = executor
    this.maxConcurrency = options.maxConcurrency || 8
    this.context = {
      variables: {},
      results: new Map(),
      errors: new Map()
    }
  }

  /**
   * 执行工作流
   */
  async run(): Promise<WorkflowResult> {
    const startTime = Date.now()
    const completedNodes: string[] = []
    const failedNodes: string[] = []
    const skippedNodes: string[] = []

    // 构建节点映射
    const nodeMap = new Map<string, WorkflowNode>()
    this.workflow.nodes.forEach(node => nodeMap.set(node.id, node))

    // 找到可以执行的节点（依赖已满足）
    const getExecutableNodes = (): WorkflowNode[] => {
      const executable: WorkflowNode[] = []
      
      for (const node of this.workflow.nodes) {
        // 跳过已完成的节点
        if (completedNodes.includes(node.id) || 
            failedNodes.includes(node.id) || 
            skippedNodes.includes(node.id)) {
          continue
        }

        // 检查依赖
        const dependenciesMet = node.dependencies.every(depId => {
          return completedNodes.includes(depId)
        })

        if (!dependenciesMet) {
          continue
        }

        // 检查条件
        if (node.condition && !node.condition(this.context)) {
          skippedNodes.push(node.id)
          continue
        }

        executable.push(node)
      }

      return executable
    }

    // 执行节点
    while (true) {
      const executableNodes = getExecutableNodes()
      
      if (executableNodes.length === 0) {
        // 检查是否所有节点都已完成
        const allNodesProcessed = this.workflow.nodes.every(node =>
          completedNodes.includes(node.id) ||
          failedNodes.includes(node.id) ||
          skippedNodes.includes(node.id)
        )
        
        if (allNodesProcessed) {
          break
        }

        // 如果还有未处理的节点但无法执行，说明存在循环依赖或其他问题
        const remainingNodes = this.workflow.nodes.filter(node =>
          !completedNodes.includes(node.id) &&
          !failedNodes.includes(node.id) &&
          !skippedNodes.includes(node.id)
        )
        
        if (remainingNodes.length > 0) {
          console.error('⚠️ 工作流停滞，无法继续执行以下节点:', 
            remainingNodes.map(n => n.id))
          remainingNodes.forEach(node => failedNodes.push(node.id))
        }
        
        break
      }

      // 并行执行可执行节点（限制并发数）
      const nodesToExecute = executableNodes.slice(0, this.maxConcurrency)
      
      const promises = nodesToExecute.map(node => this.executeNode(node))
      const results = await Promise.allSettled(promises)

      // 处理结果
      results.forEach((result, index) => {
        const node = nodesToExecute[index]
        
        if (result.status === 'fulfilled') {
          completedNodes.push(node.id)
          this.context.results.set(node.id, result.value)
          
          // 处理成功跳转
          if (node.onsuccess) {
            const nextNode = nodeMap.get(node.onsuccess)
            if (nextNode) {
              // 将下一个节点添加到待处理列表
            }
          }
        } else {
          failedNodes.push(node.id)
          this.context.errors.set(node.id, result.reason)
          
          // 处理失败跳转
          if (node.onfailure) {
            const nextNode = nodeMap.get(node.onfailure)
            if (nextNode) {
              // 将下一个节点添加到待处理列表
            }
          }
        }
      })
    }

    const executionTime = Date.now() - startTime
    const success = failedNodes.length === 0

    return {
      success,
      completedNodes,
      failedNodes,
      skippedNodes,
      context: this.context,
      executionTime
    }
  }

  /**
   * 执行单个节点（支持重试）
   */
  private async executeNode(node: WorkflowNode): Promise<any> {
    const maxRetries = node.retryCount || 0
    const retryDelay = node.retryDelay || 1000
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`▶️ 执行节点: ${node.id} (尝试 ${attempt + 1}/${maxRetries + 1})`)
        const result = await this.executor.execute(node.task, this.context)
        console.log(`✅ 节点完成: ${node.id}`)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`❌ 节点失败: ${node.id}`, {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1
        })
        
        if (attempt < maxRetries) {
          console.log(`⏳ ${retryDelay}ms 后重试...`)
          await this.sleep(retryDelay)
        }
      }
    }

    throw lastError || new Error(`Node ${node.id} failed after ${maxRetries + 1} attempts`)
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 设置上下文变量
   */
  setVariable(key: string, value: any): void {
    this.context.variables[key] = value
  }

  /**
   * 获取上下文变量
   */
  getVariable(key: string): any {
    return this.context.variables[key]
  }
}

/**
 * 工作流构建器
 */
export class WorkflowBuilder {
  private nodes: WorkflowNode[] = []
  private startNodeId?: string

  addNode(
    id: string,
    task: Task,
    options: Partial<WorkflowNode> = {}
  ): WorkflowBuilder {
    this.nodes.push({
      id,
      task,
      dependencies: options.dependencies || [],
      ...options
    })
    return this
  }

  setStartNode(nodeId: string): WorkflowBuilder {
    this.startNodeId = nodeId
    return this
  }

  build(name: string): Workflow {
    if (!this.startNodeId) {
      // 如果没有设置起始节点，使用第一个无依赖的节点
      const startNode = this.nodes.find(n => n.dependencies.length === 0)
      if (!startNode) {
        throw new Error('No suitable start node found')
      }
      this.startNodeId = startNode.id
    }

    return {
      id: `workflow-${Date.now()}`,
      name,
      nodes: this.nodes,
      startNode: this.startNodeId
    }
  }
}
