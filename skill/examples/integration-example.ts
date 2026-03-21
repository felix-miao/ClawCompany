/**
 * ClawCompany Integration Example
 * 
 * 演示如何结合使用 Workflow Engine、State Management 和 Plugin System
 */

import { 
  ClawCompanyOrchestrator,
  StateManager,
  WorkflowEngine,
  WorkflowBuilder,
  PluginManager,
  Plugin
} from '../src'

// ============================================
// 示例 1：完整的工作流 + 插件集成
// ============================================

async function example1() {
  console.log('=== 示例 1：完整集成示例 ===\n')

  // 1. 创建 Orchestrator
  const orchestrator = new ClawCompanyOrchestrator()
  
  // 2. 创建 Plugin Manager
  const pluginManager = new PluginManager({ autoLoad: false })
  
  // 3. 注册插件
  const loggerPlugin: Plugin = {
    id: 'logger',
    name: 'Logger Plugin',
    version: '1.0.0',
    
    onTaskStart: async (task, context) => {
      context.logger.log(`🚀 Starting task: ${task.title}`)
      const count = (context.api.getState('taskCount') || 0) + 1
      context.api.setState('taskCount', count)
    },
    
    onTaskComplete: async (task, result, context) => {
      const count = context.api.getState('taskCount')
      context.logger.log(`✅ Task ${count} completed: ${task.title}`)
      context.logger.log(`   Success: ${result.success}`)
    }
  }
  
  pluginManager.register(loggerPlugin)
  await pluginManager.enable('logger')
  
  // 4. 执行任务（插件会自动触发）
  const result = await orchestrator.execute('创建一个登录页面')
  
  console.log('\n📋 Execution Result:')
  console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
  console.log(`   Summary: ${result.summary}`)
  
  // 5. 清理
  await pluginManager.disable('logger')
}

// ============================================
// 示例 2：使用 Workflow Engine + State Management
// ============================================

async function example2() {
  console.log('\n=== 示例 2：Workflow + State 集成 ===\n')

  // 1. 创建 State Manager
  const stateManager = new StateManager({
    persistPath: './temp/state.json',
    maxHistory: 100
  })
  
  // 2. 创建 Workflow Engine
  const workflowEngine = new WorkflowEngine({
    stateManager
  })
  
  // 3. 使用 Builder 创建工作流
  const workflow = new WorkflowBuilder('feature-development')
    .setDescription('Feature Development Workflow')
    .addTask('analyze', '分析需求', async (context) => {
      console.log('📊 Analyzing requirements...')
      context.state.set('requirements', ['login', 'logout', 'register'])
      return { success: true, data: { features: 3 } }
    })
    .addTask('design', '设计架构', async (context) => {
      console.log('🎨 Designing architecture...')
      const requirements = context.state.get('requirements')
      return { success: true, data: { components: requirements.length } }
    })
    .addTask('implement', '实现功能', async (context) => {
      console.log('💻 Implementing features...')
      const requirements = context.state.get('requirements')
      
      // 模拟实现每个功能
      for (const feature of requirements) {
        console.log(`   - Implementing ${feature}...`)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      return { success: true, data: { implemented: requirements.length } }
    })
    .addTask('test', '编写测试', async (context) => {
      console.log('🧪 Writing tests...')
      return { success: true, data: { coverage: '95%' } }
    })
    .addTask('deploy', '部署上线', async (context) => {
      console.log('🚀 Deploying...')
      return { success: true, data: { environment: 'production' } }
    })
    .build()
  
  // 4. 执行工作流
  const result = await workflowEngine.execute(workflow)
  
  console.log('\n📋 Workflow Result:')
  console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
  console.log(`   Nodes executed: ${result.nodesExecuted.length}`)
  console.log(`   Duration: ${result.duration}ms`)
  
  // 5. 查看状态快照
  const snapshot = stateManager.createSnapshot()
  console.log('\n📊 State Snapshot:')
  console.log(`   Total changes: ${snapshot.changes.length}`)
  console.log(`   Current state keys: ${Object.keys(snapshot.state).length}`)
  
  // 6. 清理
  stateManager.clear()
}

// ============================================
// 示例 3：插件协作 - 监控和通知
// ============================================

async function example3() {
  console.log('\n=== 示例 3：插件协作示例 ===\n')

  const pluginManager = new PluginManager({ autoLoad: false })
  
  // 1. 性能监控插件
  const performancePlugin: Plugin = {
    id: 'performance-monitor',
    name: 'Performance Monitor',
    version: '1.0.0',
    
    onEnable: async (context) => {
      context.api.setState('metrics', [])
    },
    
    onTaskStart: async (task, context) => {
      context.api.setState(`startTime:${task.id}`, Date.now())
    },
    
    onTaskComplete: async (task, result, context) => {
      const startTime = context.api.getState(`startTime:${task.id}`)
      const duration = Date.now() - startTime
      
      const metrics = context.api.getState('metrics') || []
      metrics.push({ taskId: task.id, duration, success: result.success })
      context.api.setState('metrics', metrics)
      
      // 发送性能事件
      context.api.emit('performance:metric', {
        taskId: task.id,
        duration,
        success: result.success
      })
    },
    
    onDisable: async (context) => {
      const metrics = context.api.getState('metrics')
      if (metrics && metrics.length > 0) {
        const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
        const successRate = metrics.filter(m => m.success).length / metrics.length * 100
        
        console.log('\n📊 Performance Summary:')
        console.log(`   Total tasks: ${metrics.length}`)
        console.log(`   Average duration: ${avgDuration.toFixed(0)}ms`)
        console.log(`   Success rate: ${successRate.toFixed(1)}%`)
      }
    }
  }
  
  // 2. 通知插件（监听性能事件）
  const notificationPlugin: Plugin = {
    id: 'notifications',
    name: 'Notification System',
    version: '1.0.0',
    
    onEnable: async (context) => {
      // 监听慢任务
      context.api.on('performance:metric', (data) => {
        if (data.duration > 1000) {
          console.log(`⚠️  Slow task detected: ${data.taskId} (${data.duration}ms)`)
        }
      })
    }
  }
  
  // 3. 日志插件
  const loggerPlugin: Plugin = {
    id: 'logger',
    name: 'Logger',
    version: '1.0.0',
    
    onTaskStart: async (task, context) => {
      console.log(`\n🚀 Task started: ${task.title || task.id}`)
    },
    
    onTaskComplete: async (task, result, context) => {
      const emoji = result.success ? '✅' : '❌'
      console.log(`${emoji} Task completed: ${task.title || task.id}`)
    }
  }
  
  // 注册并启用所有插件
  pluginManager.register(performancePlugin)
  pluginManager.register(notificationPlugin)
  pluginManager.register(loggerPlugin)
  
  await pluginManager.enable('performance-monitor')
  await pluginManager.enable('notifications')
  await pluginManager.enable('logger')
  
  // 模拟执行多个任务
  console.log('Executing tasks...\n')
  
  const tasks = [
    { id: 'task-1', title: 'Analyze requirements' },
    { id: 'task-2', title: 'Design architecture' },
    { id: 'task-3', title: 'Implement feature' },
    { id: 'task-4', title: 'Write tests' },
    { id: 'task-5', title: 'Deploy to production' }
  ]
  
  for (const task of tasks) {
    await pluginManager.triggerHook('onTaskStart', task)
    
    // 模拟任务执行（随机时长）
    await new Promise(resolve => 
      setTimeout(resolve, Math.random() * 1500 + 200)
    )
    
    await pluginManager.triggerHook('onTaskComplete', task, { 
      success: Math.random() > 0.2  // 80% 成功率
    })
  }
  
  // 禁用插件（会显示性能摘要）
  await pluginManager.disable('performance-monitor')
}

// ============================================
// 示例 4：端到端场景 - 带状态的工作流
// ============================================

async function example4() {
  console.log('\n=== 示例 4：端到端场景 ===\n')

  // 1. 创建 State Manager
  const stateManager = new StateManager({
    persistPath: './temp/project-state.json',
    maxHistory: 200
  })
  
  // 2. 创建 Plugin Manager
  const pluginManager = new PluginManager({ autoLoad: false })
  
  // 3. 注册 Git 集成插件
  const gitPlugin: Plugin = {
    id: 'git-integration',
    name: 'Git Integration',
    version: '1.0.0',
    
    onEnable: async (context) => {
      context.api.setState('commits', [])
    },
    
    onTaskComplete: async (task, result, context) => {
      if (result.success && result.data?.filesChanged) {
        const commits = context.api.getState('commits') || []
        commits.push({
          taskId: task.id,
          message: `feat: ${task.title}`,
          timestamp: new Date().toISOString()
        })
        context.api.setState('commits', commits)
        
        console.log(`📝 Git commit created: feat: ${task.title}`)
      }
    },
    
    onDisable: async (context) => {
      const commits = context.api.getState('commits')
      console.log(`\n📊 Git Summary: ${commits.length} commits created`)
    }
  }
  
  pluginManager.register(gitPlugin)
  await pluginManager.enable('git-integration')
  
  // 4. 创建 Workflow Engine
  const workflowEngine = new WorkflowEngine({
    stateManager
  })
  
  // 5. 定义完整的项目工作流
  const workflow = new WorkflowBuilder('full-project-workflow')
    .setDescription('Complete Project Development Workflow')
    .addTask('init', 'Initialize Project', async (context) => {
      console.log('📦 Initializing project...')
      context.state.set('projectName', 'my-awesome-app')
      context.state.set('createdAt', new Date().toISOString())
      return { success: true, data: { initialized: true } }
    })
    .addTask('requirements', 'Gather Requirements', async (context) => {
      console.log('📋 Gathering requirements...')
      const requirements = [
        'User authentication',
        'Dashboard',
        'Settings page',
        'API integration'
      ]
      context.state.set('requirements', requirements)
      return { success: true, data: { count: requirements.length } }
    })
    .addTask('design', 'Design System', async (context) => {
      console.log('🎨 Designing system architecture...')
      const requirements = context.state.get('requirements')
      const design = {
        components: requirements.length * 3,
        pages: requirements.length,
        apis: Math.ceil(requirements.length / 2)
      }
      context.state.set('design', design)
      return { success: true, data: design }
    })
    .addTask('implement', 'Implement Features', async (context) => {
      console.log('💻 Implementing features...')
      const requirements = context.state.get('requirements')
      
      for (const req of requirements) {
        console.log(`   ✓ ${req}`)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      return { 
        success: true, 
        data: { 
          featuresImplemented: requirements.length,
          filesChanged: true  // 触发 Git 插件
        }
      }
    })
    .addTask('test', 'Run Tests', async (context) => {
      console.log('🧪 Running tests...')
      await new Promise(resolve => setTimeout(resolve, 200))
      const coverage = 95 + Math.random() * 5
      return { success: true, data: { coverage: `${coverage.toFixed(1)}%` } }
    })
    .addTask('deploy', 'Deploy Application', async (context) => {
      console.log('🚀 Deploying application...')
      const projectName = context.state.get('projectName')
      
      // 触发 Git 插件
      await pluginManager.triggerHook('onTaskComplete', 
        { id: 'deploy', title: 'Deploy Application' },
        { success: true, data: { filesChanged: true } }
      )
      
      return { 
        success: true, 
        data: { 
          url: `https://${projectName}.vercel.app`,
          environment: 'production'
        }
      }
    })
    .build()
  
  // 6. 执行工作流
  const result = await workflowEngine.execute(workflow)
  
  console.log('\n📋 Final Result:')
  console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`)
  console.log(`   Duration: ${result.duration}ms`)
  console.log(`   Nodes executed: ${result.nodesExecuted.join(' → ')}`)
  
  // 7. 查看最终状态
  const finalState = stateManager.createSnapshot()
  console.log('\n📊 Final State:')
  console.log(`   Project: ${finalState.state.projectName}`)
  console.log(`   Requirements: ${finalState.state.requirements?.length}`)
  console.log(`   Design: ${JSON.stringify(finalState.state.design)}`)
  console.log(`   Total state changes: ${finalState.changes.length}`)
  
  // 8. 清理
  await pluginManager.disable('git-integration')
  stateManager.clear()
}

// ============================================
// 运行所有示例
// ============================================

async function main() {
  try {
    await example1()
    await example2()
    await example3()
    await example4()
    
    console.log('\n✅ All examples completed successfully!')
  } catch (error) {
    console.error('❌ Error running examples:', error)
    process.exit(1)
  }
}

// 运行
if (require.main === module) {
  main()
}

export {
  example1,
  example2,
  example3,
  example4
}
