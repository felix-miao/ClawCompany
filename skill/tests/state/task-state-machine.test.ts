/**
 * Task State Machine Tests
 * 
 * 测试任务状态机的核心功能
 */

import {
  TaskStateMachine,
  TaskState,
  AgentRole,
  Task,
  FlowLogEntry,
  STATE_TRANSITIONS,
  PERMISSION_MATRIX
} from '../../src/state/task-state-machine'
import * as fs from 'fs'
import * as path from 'path'

// 测试配置
const TEST_DIR = './test-state-machine'
const TEST_FLOW_LOG_PATH = path.join(TEST_DIR, 'flow-logs')
const TEST_TASK_STORAGE_PATH = path.join(TEST_DIR, 'tasks')

// 辅助函数：清理测试目录
function cleanupTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

// 辅助函数：创建测试状态机
function createTestStateMachine(): TaskStateMachine {
  return new TaskStateMachine({
    flowLogPath: TEST_FLOW_LOG_PATH,
    taskStoragePath: TEST_TASK_STORAGE_PATH
  })
}

describe('TaskStateMachine', () => {
  let stateMachine: TaskStateMachine

  beforeEach(() => {
    cleanupTestDir()
    stateMachine = createTestStateMachine()
  })

  afterAll(() => {
    cleanupTestDir()
  })

  // ============ 创建任务测试 ============

  describe('createTask', () => {
    it('应该成功创建任务（PM 角色）', () => {
      const task = stateMachine.createTask(
        '测试任务',
        '这是一个测试任务',
        AgentRole.PM
      )

      expect(task.id).toBeDefined()
      expect(task.title).toBe('测试任务')
      expect(task.description).toBe('这是一个测试任务')
      expect(task.state).toBe(TaskState.PENDING)
      expect(task.createdBy).toBe(AgentRole.PM)
      expect(task.retryCount).toBe(0)
      expect(task.escalationLevel).toBe(0)
      expect(task.flowLog).toHaveLength(0)
    })

    it('应该拒绝非 PM 角色创建任务', () => {
      expect(() => {
        stateMachine.createTask(
          '测试任务',
          '这是一个测试任务',
          AgentRole.DEVELOPER
        )
      }).toThrow('没有创建任务的权限')
    })

    it('应该保存任务到文件', () => {
      const task = stateMachine.createTask(
        '测试任务',
        '这是一个测试任务',
        AgentRole.PM
      )

      const taskFile = path.join(TEST_TASK_STORAGE_PATH, `${task.id}.json`)
      expect(fs.existsSync(taskFile)).toBe(true)

      const savedTask = JSON.parse(fs.readFileSync(taskFile, 'utf-8'))
      expect(savedTask.id).toBe(task.id)
    })
  })

  // ============ 状态转移测试 ============

  describe('transition', () => {
    let task: Task

    beforeEach(() => {
      task = stateMachine.createTask(
        '测试任务',
        '这是一个测试任务',
        AgentRole.PM
      )
    })

    it('应该成功执行合法的状态转移（Pending → Planning）', () => {
      const result = stateMachine.transition(
        task.id,
        TaskState.PLANNING,
        AgentRole.PM,
        '开始规划'
      )

      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.PLANNING)
      expect(result.flowLogEntry).toBeDefined()
      expect(result.flowLogEntry?.fromState).toBe(TaskState.PENDING)
      expect(result.flowLogEntry?.toState).toBe(TaskState.PLANNING)
      expect(result.flowLogEntry?.agent).toBe(AgentRole.PM)
    })

    it('应该拒绝非法的状态转移（Pending → Done）', () => {
      const result = stateMachine.transition(
        task.id,
        TaskState.DONE,
        AgentRole.PM
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('非法状态转移')
    })

    it('应该拒绝无权限的状态转移', () => {
      // 先转移到 Planning
      stateMachine.transition(task.id, TaskState.PLANNING, AgentRole.PM)

      // Developer 尝试转移到 Review（无权限）
      const result = stateMachine.transition(
        task.id,
        TaskState.REVIEW,
        AgentRole.DEVELOPER
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('没有权限')
    })

    it('应该记录流转历史', () => {
      stateMachine.transition(task.id, TaskState.PLANNING, AgentRole.PM)
      stateMachine.transition(task.id, TaskState.REVIEW, AgentRole.PM)

      const flowLog = stateMachine.getTaskFlowLog(task.id)
      expect(flowLog).toHaveLength(2)
      expect(flowLog[0].toState).toBe(TaskState.PLANNING)
      expect(flowLog[1].toState).toBe(TaskState.REVIEW)
    })

    it('应该保存流转记录到文件', () => {
      stateMachine.transition(task.id, TaskState.PLANNING, AgentRole.PM)

      const date = new Date().toISOString().split('T')[0]
      const flowLogFile = path.join(TEST_FLOW_LOG_PATH, `flow-${date}.jsonl`)
      expect(fs.existsSync(flowLogFile)).toBe(true)

      const content = fs.readFileSync(flowLogFile, 'utf-8')
      const entries = content.trim().split('\n').map(line => JSON.parse(line))
      expect(entries).toHaveLength(1)
      expect(entries[0].taskId).toBe(task.id)
    })
  })

  // ============ 权限检查测试 ============

  describe('权限检查', () => {
    it('PM 应该有创建任务的权限', () => {
      expect(stateMachine.hasPermission(AgentRole.PM, 'canCreate')).toBe(true)
    })

    it('Developer 不应该有创建任务的权限', () => {
      expect(stateMachine.hasPermission(AgentRole.DEVELOPER, 'canCreate')).toBe(false)
    })

    it('Reviewer 应该有批准任务的权限', () => {
      expect(stateMachine.hasPermission(AgentRole.REVIEWER, 'canApprove')).toBe(true)
    })

    it('Reviewer 应该有封驳任务的权限', () => {
      expect(stateMachine.hasPermission(AgentRole.REVIEWER, 'canReject')).toBe(true)
    })
  })

  // ============ 状态转移规则测试 ============

  describe('状态转移规则', () => {
    it('应该正确识别合法的状态转移', () => {
      expect(stateMachine.isValidTransition(TaskState.PENDING, TaskState.PLANNING)).toBe(true)
      expect(stateMachine.isValidTransition(TaskState.PLANNING, TaskState.REVIEW)).toBe(true)
      expect(stateMachine.isValidTransition(TaskState.REVIEW, TaskState.ASSIGNED)).toBe(true)
      expect(stateMachine.isValidTransition(TaskState.DOING, TaskState.TESTING)).toBe(true)
    })

    it('应该正确识别非法的状态转移', () => {
      expect(stateMachine.isValidTransition(TaskState.PENDING, TaskState.DONE)).toBe(false)
      expect(stateMachine.isValidTransition(TaskState.DONE, TaskState.DOING)).toBe(false)
      expect(stateMachine.isValidTransition(TaskState.CANCELLED, TaskState.PLANNING)).toBe(false)
    })

    it('终态不应该有任何转移', () => {
      expect(STATE_TRANSITIONS[TaskState.DONE]).toHaveLength(0)
      expect(STATE_TRANSITIONS[TaskState.CANCELLED]).toHaveLength(0)
    })
  })

  // ============ 查询功能测试 ============

  describe('查询功能', () => {
    beforeEach(() => {
      // 创建多个任务
      stateMachine.createTask('任务1', '描述1', AgentRole.PM)
      stateMachine.createTask('任务2', '描述2', AgentRole.PM)
      
      const task3 = stateMachine.createTask('任务3', '描述3', AgentRole.PM)
      stateMachine.transition(task3.id, TaskState.PLANNING, AgentRole.PM)
    })

    it('应该正确获取所有任务', () => {
      const tasks = stateMachine.getAllTasks()
      expect(tasks).toHaveLength(3)
    })

    it('应该正确按状态筛选任务', () => {
      const pendingTasks = stateMachine.getTasksByState(TaskState.PENDING)
      expect(pendingTasks).toHaveLength(2)

      const planningTasks = stateMachine.getTasksByState(TaskState.PLANNING)
      expect(planningTasks).toHaveLength(1)
    })
  })

  // ============ 停滞任务处理测试 ============

  describe('handleStalledTask', () => {
    let task: Task

    beforeEach(() => {
      task = stateMachine.createTask('测试任务', '描述', AgentRole.PM)
      // 修改 updatedAt 为 5 分钟前
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      task.updatedAt = fiveMinutesAgo
      stateMachine['saveTask'](task)
    })

    it('3分钟内不应该处理', () => {
      const recentTask = stateMachine.createTask('新任务', '描述', AgentRole.PM)
      const result = stateMachine.handleStalledTask(recentTask.id)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('3分钟内')
    })

    it('应该自动重试（retryCount < maxRetryCount）', () => {
      const result = stateMachine.handleStalledTask(task.id)
      
      expect(result.success).toBe(true)
      const updatedTask = stateMachine.getTask(task.id)
      expect(updatedTask?.retryCount).toBe(1)
    })

    it('达到最大重试次数后应该升级', () => {
      // 设置 retryCount 为最大值
      task.retryCount = 3
      stateMachine['saveTask'](task)

      const result = stateMachine.handleStalledTask(task.id)
      
      expect(result.success).toBe(true)
      const updatedTask = stateMachine.getTask(task.id)
      expect(updatedTask?.escalationLevel).toBe(1)
      expect(updatedTask?.state).toBe(TaskState.BLOCKED)
    })
  })

  // ============ 完整工作流测试 ============

  describe('完整工作流', () => {
    it('应该成功执行完整的任务流程', () => {
      // 1. 创建任务
      const task = stateMachine.createTask(
        '实现登录功能',
        '用户登录功能实现',
        AgentRole.PM
      )
      expect(task.state).toBe(TaskState.PENDING)

      // 2. PM 开始规划
      let result = stateMachine.transition(
        task.id,
        TaskState.PLANNING,
        AgentRole.PM,
        '开始规划'
      )
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.PLANNING)

      // 3. 提交审核
      result = stateMachine.transition(
        task.id,
        TaskState.REVIEW,
        AgentRole.PM,
        '提交审核'
      )
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.REVIEW)

      // 4. Reviewer 批准
      result = stateMachine.transition(
        task.id,
        TaskState.ASSIGNED,
        AgentRole.REVIEWER,
        '审核通过'
      )
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.ASSIGNED)

      // 5. 开始开发
      result = stateMachine.transition(
        task.id,
        TaskState.DOING,
        AgentRole.ARCHITECT,
        '派发给开发者'
      )
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.DOING)

      // 6. 提交测试
      result = stateMachine.transition(
        task.id,
        TaskState.TESTING,
        AgentRole.DEVELOPER,
        '开发完成'
      )
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.TESTING)

      // 7. 测试通过
      result = stateMachine.transition(
        task.id,
        TaskState.DONE,
        AgentRole.TESTER,
        '测试通过'
      )
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.DONE)

      // 验证流转历史
      const flowLog = stateMachine.getTaskFlowLog(task.id)
      expect(flowLog).toHaveLength(6)  // 6 次状态转移（不包含创建）
    })

    it('应该支持审核打回流程', () => {
      const task = stateMachine.createTask('测试任务', '描述', AgentRole.PM)
      
      // Pending → Planning
      stateMachine.transition(task.id, TaskState.PLANNING, AgentRole.PM)
      
      // Planning → Review
      stateMachine.transition(task.id, TaskState.REVIEW, AgentRole.PM)
      
      // Review → Planning（打回）
      const result = stateMachine.transition(
        task.id,
        TaskState.PLANNING,
        AgentRole.REVIEWER,
        '方案需要修改'
      )
      
      expect(result.success).toBe(true)
      expect(result.task?.state).toBe(TaskState.PLANNING)
    })
  })
})

// ============ 常量测试 ============

describe('Constants', () => {
  describe('STATE_TRANSITIONS', () => {
    it('应该定义所有状态的转移规则', () => {
      expect(STATE_TRANSITIONS[TaskState.PENDING]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.PLANNING]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.REVIEW]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.ASSIGNED]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.DOING]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.TESTING]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.DONE]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.CANCELLED]).toBeDefined()
      expect(STATE_TRANSITIONS[TaskState.BLOCKED]).toBeDefined()
    })
  })

  describe('PERMISSION_MATRIX', () => {
    it('应该定义所有角色的权限', () => {
      expect(PERMISSION_MATRIX[AgentRole.PM]).toBeDefined()
      expect(PERMISSION_MATRIX[AgentRole.REVIEWER]).toBeDefined()
      expect(PERMISSION_MATRIX[AgentRole.ARCHITECT]).toBeDefined()
      expect(PERMISSION_MATRIX[AgentRole.DEVELOPER]).toBeDefined()
      expect(PERMISSION_MATRIX[AgentRole.TESTER]).toBeDefined()
      expect(PERMISSION_MATRIX[AgentRole.DEVOPS]).toBeDefined()
    })

    it('PM 应该有正确的权限', () => {
      const pmPermissions = PERMISSION_MATRIX[AgentRole.PM]
      expect(pmPermissions.canCreate).toBe(true)
      expect(pmPermissions.canEdit).toContain(TaskState.PLANNING)
      expect(pmPermissions.canDispatch).toContain(AgentRole.DEVELOPER)
    })

    it('Reviewer 应该有审核权限', () => {
      const reviewerPermissions = PERMISSION_MATRIX[AgentRole.REVIEWER]
      expect(reviewerPermissions.canApprove).toBe(true)
      expect(reviewerPermissions.canReject).toBe(true)
    })
  })
})
