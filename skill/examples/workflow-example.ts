/**
 * 工作流引擎使用示例
 * 
 * 展示如何使用 WorkflowEngine 创建复杂的任务工作流
 */

import { WorkflowEngine, WorkflowBuilder, TaskExecutor, WorkflowContext } from './src/workflow/engine'
import { Task } from './src/orchestrator'

// 示例 1: 简单的顺序工作流
async function simpleSequentialWorkflow() {
  console.log('=== 示例 1: 简单的顺序工作流 ===\n')

  // 创建任务执行器
  const executor: TaskExecutor = {
    execute: async (task: Task, context: WorkflowContext) => {
      console.log(`  执行任务: ${task.title}`)
      await new Promise(resolve => setTimeout(resolve, 100))
      return { taskId: task.id, completed: true }
    }
  }

  // 构建工作流
  const workflow = new WorkflowBuilder()
    .addNode('task-1', {
      id: 'task-1',
      title: '需求分析',
      description: '分析用户需求',
      assignedTo: 'dev',
      dependencies: [],
      status: 'pending'
    })
    .addNode('task-2', {
      id: 'task-2',
      title: 'UI 设计',
      description: '设计用户界面',
      assignedTo: 'dev',
      dependencies: ['task-1'],
      status: 'pending'
    })
    .addNode('task-3', {
      id: 'task-3',
      title: '代码实现',
      description: '实现功能',
      assignedTo: 'dev',
      dependencies: ['task-2'],
      status: 'pending'
    })
    .build('顺序开发流程')

  // 执行工作流
  const engine = new WorkflowEngine(workflow, executor)
  const result = await engine.run()

  console.log('\n结果:', {
    success: result.success,
    completedNodes: result.completedNodes,
    executionTime: `${result.executionTime}ms`
  })
}

// 示例 2: 并行工作流
async function parallelWorkflow() {
  console.log('\n=== 示例 2: 并行工作流 ===\n')

  const executor: TaskExecutor = {
    execute: async (task: Task, context: WorkflowContext) => {
      console.log(`  [开始] ${task.title}`)
      await new Promise(resolve => setTimeout(resolve, 200))
      console.log(`  [完成] ${task.title}`)
      return { taskId: task.id }
    }
  }

  // 构建并行工作流（多个独立任务）
  const workflow = new WorkflowBuilder()
    .addNode('setup', {
      id: 'setup',
      title: '环境配置',
      description: '配置开发环境',
      assignedTo: 'dev',
      dependencies: [],
      status: 'pending'
    })
    .addNode('frontend', {
      id: 'frontend',
      title: '前端开发',
      description: '开发前端界面',
      assignedTo: 'dev',
      dependencies: ['setup'],
      status: 'pending'
    })
    .addNode('backend', {
      id: 'backend',
      title: '后端开发',
      description: '开发后端 API',
      assignedTo: 'dev',
      dependencies: ['setup'],
      status: 'pending'
    })
    .addNode('database', {
      id: 'database',
      title: '数据库设计',
      description: '设计数据库结构',
      assignedTo: 'dev',
      dependencies: ['setup'],
      status: 'pending'
    })
    .addNode('integration', {
      id: 'integration',
      title: '集成测试',
      description: '集成所有模块',
      assignedTo: 'dev',
      dependencies: ['frontend', 'backend', 'database'],
      status: 'pending'
    })
    .build('并行开发流程')

  // 执行工作流（最大并发数 = 3）
  const engine = new WorkflowEngine(workflow, executor, { maxConcurrency: 3 })
  const result = await engine.run()

  console.log('\n结果:', {
    success: result.success,
    completedNodes: result.completedNodes,
    executionTime: `${result.executionTime}ms`
  })
}

// 示例 3: 条件分支工作流
async function conditionalWorkflow() {
  console.log('\n=== 示例 3: 条件分支工作流 ===\n')

  const executor: TaskExecutor = {
    execute: async (task: Task, context: WorkflowContext) => {
      console.log(`  执行: ${task.title}`)
      return { taskId: task.id }
    }
  }

  // 构建带条件的工作流
  const workflow = new WorkflowBuilder()
    .addNode('check-requirements', {
      id: 'check-requirements',
      title: '检查需求',
      description: '分析需求完整性',
      assignedTo: 'dev',
      dependencies: [],
      status: 'pending'
    })
    .addNode('simple-implementation', {
      id: 'simple-implementation',
      title: '简单实现',
      description: '快速实现基础功能',
      assignedTo: 'dev',
      dependencies: ['check-requirements'],
      status: 'pending'
    }, {
      // 只在简单模式下执行
      condition: (context) => context.variables.complexity === 'simple'
    })
    .addNode('complex-design', {
      id: 'complex-design',
      title: '复杂设计',
      description: '详细设计架构',
      assignedTo: 'dev',
      dependencies: ['check-requirements'],
      status: 'pending'
    }, {
      // 只在复杂模式下执行
      condition: (context) => context.variables.complexity === 'complex'
    })
    .addNode('complex-implementation', {
      id: 'complex-implementation',
      title: '复杂实现',
      description: '实现完整功能',
      assignedTo: 'dev',
      dependencies: ['complex-design'],
      status: 'pending'
    }, {
      condition: (context) => context.variables.complexity === 'complex'
    })
    .build('条件分支流程')

  // 测试简单模式
  console.log('--- 简单模式 ---')
  const engine1 = new WorkflowEngine(workflow, executor)
  engine1.setVariable('complexity', 'simple')
  const result1 = await engine1.run()
  console.log('完成节点:', result1.completedNodes)
  console.log('跳过节点:', result1.skippedNodes)

  // 测试复杂模式
  console.log('\n--- 复杂模式 ---')
  const engine2 = new WorkflowEngine(workflow, executor)
  engine2.setVariable('complexity', 'complex')
  const result2 = await engine2.run()
  console.log('完成节点:', result2.completedNodes)
  console.log('跳过节点:', result2.skippedNodes)
}

// 示例 4: 带重试的工作流
async function retryWorkflow() {
  console.log('\n=== 示例 4: 带重试的工作流 ===\n')

  let attempts = 0
  const executor: TaskExecutor = {
    execute: async (task: Task, context: WorkflowContext) => {
      attempts++
      console.log(`  尝试 #${attempts}: ${task.title}`)
      
      // 模拟前两次失败，第三次成功
      if (attempts < 3) {
        throw new Error('网络超时')
      }
      
      return { taskId: task.id, attempts }
    }
  }

  // 构建带重试的工作流
  const workflow = new WorkflowBuilder()
    .addNode('unstable-task', {
      id: 'unstable-task',
      title: '不稳定任务',
      description: '可能失败的任务',
      assignedTo: 'dev',
      dependencies: [],
      status: 'pending'
    }, {
      retryCount: 3,    // 最多重试 3 次
      retryDelay: 100   // 每次重试间隔 100ms
    })
    .build('重试流程')

  const engine = new WorkflowEngine(workflow, executor)
  const result = await engine.run()

  console.log('\n结果:', {
    success: result.success,
    completedNodes: result.completedNodes,
    totalAttempts: attempts
  })
}

// 运行所有示例
async function main() {
  try {
    await simpleSequentialWorkflow()
    await parallelWorkflow()
    await conditionalWorkflow()
    await retryWorkflow()
    
    console.log('\n✅ 所有示例运行完成！')
  } catch (error) {
    console.error('❌ 运行失败:', error)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
}

export {
  simpleSequentialWorkflow,
  parallelWorkflow,
  conditionalWorkflow,
  retryWorkflow
}
