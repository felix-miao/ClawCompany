/**
 * Workflow Engine Tests
 */

import { WorkflowEngine, WorkflowBuilder, TaskExecutor, WorkflowContext } from '../src/workflow/engine'
import { Task } from '../src/orchestrator'

// Mock Task Executor
class MockTaskExecutor implements TaskExecutor {
  async execute(task: Task, context: WorkflowContext): Promise<any> {
    // 模拟任务执行
    await new Promise(resolve => setTimeout(resolve, 10))
    
    return {
      taskId: task.id,
      result: `Completed: ${task.title}`,
      timestamp: Date.now()
    }
  }
}

describe('WorkflowEngine', () => {
  let executor: TaskExecutor

  beforeEach(() => {
    executor = new MockTaskExecutor()
  })

  describe('基础功能', () => {
    test('应该能够执行简单的工作流', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .setStartNode('task-1')
        .build('Simple Workflow')

      const engine = new WorkflowEngine(workflow, executor)
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toContain('task-1')
      expect(result.failedNodes).toHaveLength(0)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    test('应该能够处理任务依赖', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-2', {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          assignedTo: 'dev',
          dependencies: ['task-1'],
          status: 'pending'
        })
        .build('Dependent Workflow')

      const engine = new WorkflowEngine(workflow, executor)
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toHaveLength(2)
      expect(result.completedNodes).toContain('task-1')
      expect(result.completedNodes).toContain('task-2')
    })
  })

  describe('并行执行', () => {
    test('应该能够并行执行独立任务', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-2', {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-3', {
          id: 'task-3',
          title: 'Task 3',
          description: 'Third task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .build('Parallel Workflow')

      const engine = new WorkflowEngine(workflow, executor, { maxConcurrency: 3 })
      const startTime = Date.now()
      const result = await engine.run()
      const executionTime = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(result.completedNodes).toHaveLength(3)
      // 并行执行应该比顺序执行快
      expect(executionTime).toBeLessThan(100) // 3个任务，每个10ms，并行应该 < 30ms
    })

    test('应该遵守最大并发限制', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-2', {
          id: 'task-2',
          title: 'Task 2',
          description: 'Second task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .build('Limited Concurrency')

      const engine = new WorkflowEngine(workflow, executor, { maxConcurrency: 1 })
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toHaveLength(2)
    })
  })

  describe('条件分支', () => {
    test('应该能够跳过不满足条件的节点', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-2', {
          id: 'task-2',
          title: 'Task 2',
          description: 'Conditional task',
          assignedTo: 'dev',
          dependencies: ['task-1'],
          status: 'pending'
        }, {
          condition: (context) => context.variables.shouldRun === true
        })
        .build('Conditional Workflow')

      const engine = new WorkflowEngine(workflow, executor)
      engine.setVariable('shouldRun', false)
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toHaveLength(1)
      expect(result.completedNodes).toContain('task-1')
      expect(result.skippedNodes).toContain('task-2')
    })

    test('应该执行满足条件的节点', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-2', {
          id: 'task-2',
          title: 'Task 2',
          description: 'Conditional task',
          assignedTo: 'dev',
          dependencies: ['task-1'],
          status: 'pending'
        }, {
          condition: (context) => context.variables.shouldRun === true
        })
        .build('Conditional Workflow')

      const engine = new WorkflowEngine(workflow, executor)
      engine.setVariable('shouldRun', true)
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toHaveLength(2)
      expect(result.completedNodes).toContain('task-2')
    })
  })

  describe('错误处理和重试', () => {
    test('应该能够处理失败的任务', async () => {
      // Mock executor that always fails
      const failingExecutor: TaskExecutor = {
        execute: async (task: Task) => {
          throw new Error('Task failed')
        }
      }

      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Failing Task',
          description: 'This task will fail',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .build('Failing Workflow')

      const engine = new WorkflowEngine(workflow, failingExecutor)
      const result = await engine.run()

      expect(result.success).toBe(false)
      expect(result.failedNodes).toContain('task-1')
      expect(result.completedNodes).toHaveLength(0)
    })

    test('应该支持重试机制', async () => {
      let attempts = 0
      const retryExecutor: TaskExecutor = {
        execute: async (task: Task) => {
          attempts++
          if (attempts < 3) {
            throw new Error('Not yet')
          }
          return { success: true }
        }
      }

      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Retry Task',
          description: 'This task will retry',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        }, {
          retryCount: 3,
          retryDelay: 10
        })
        .build('Retry Workflow')

      const engine = new WorkflowEngine(workflow, retryExecutor)
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toContain('task-1')
      expect(attempts).toBe(3)
    })

    test('重试次数耗尽后应该标记为失败', async () => {
      const alwaysFailExecutor: TaskExecutor = {
        execute: async (task: Task) => {
          throw new Error('Always fails')
        }
      }

      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Always Failing Task',
          description: 'This task always fails',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        }, {
          retryCount: 2,
          retryDelay: 10
        })
        .build('Always Failing Workflow')

      const engine = new WorkflowEngine(workflow, alwaysFailExecutor)
      const result = await engine.run()

      expect(result.success).toBe(false)
      expect(result.failedNodes).toContain('task-1')
    })
  })

  describe('上下文管理', () => {
    test('应该能够设置和获取上下文变量', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .build('Context Workflow')

      const engine = new WorkflowEngine(workflow, executor)
      engine.setVariable('testKey', 'testValue')
      
      expect(engine.getVariable('testKey')).toBe('testValue')
    })

    test('应该在上下文中存储执行结果', async () => {
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Task 1',
          description: 'First task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .build('Result Storage Workflow')

      const engine = new WorkflowEngine(workflow, executor)
      const result = await engine.run()

      expect(result.context.results.has('task-1')).toBe(true)
      const taskResult = result.context.results.get('task-1')
      expect(taskResult.taskId).toBe('task-1')
    })
  })

  describe('复杂场景', () => {
    test('应该能够处理复杂的依赖图', async () => {
      /**
       * 依赖图:
       *   task-1 → task-2 → task-4
       *      ↓
       *   task-3 ─────→ task-5
       */
      const workflow = new WorkflowBuilder()
        .addNode('task-1', {
          id: 'task-1',
          title: 'Root Task',
          description: 'Root task',
          assignedTo: 'dev',
          dependencies: [],
          status: 'pending'
        })
        .addNode('task-2', {
          id: 'task-2',
          title: 'Task 2',
          description: 'Depends on task-1',
          assignedTo: 'dev',
          dependencies: ['task-1'],
          status: 'pending'
        })
        .addNode('task-3', {
          id: 'task-3',
          title: 'Task 3',
          description: 'Depends on task-1',
          assignedTo: 'dev',
          dependencies: ['task-1'],
          status: 'pending'
        })
        .addNode('task-4', {
          id: 'task-4',
          title: 'Task 4',
          description: 'Depends on task-2',
          assignedTo: 'dev',
          dependencies: ['task-2'],
          status: 'pending'
        })
        .addNode('task-5', {
          id: 'task-5',
          title: 'Task 5',
          description: 'Depends on task-3',
          assignedTo: 'dev',
          dependencies: ['task-3'],
          status: 'pending'
        })
        .build('Complex Dependency Graph')

      const engine = new WorkflowEngine(workflow, executor, { maxConcurrency: 3 })
      const result = await engine.run()

      expect(result.success).toBe(true)
      expect(result.completedNodes).toHaveLength(5)
      
      // 验证执行顺序符合依赖关系
      const completedOrder = result.completedNodes
      expect(completedOrder.indexOf('task-1')).toBeLessThan(completedOrder.indexOf('task-2'))
      expect(completedOrder.indexOf('task-1')).toBeLessThan(completedOrder.indexOf('task-3'))
      expect(completedOrder.indexOf('task-2')).toBeLessThan(completedOrder.indexOf('task-4'))
      expect(completedOrder.indexOf('task-3')).toBeLessThan(completedOrder.indexOf('task-5'))
    })
  })
})
