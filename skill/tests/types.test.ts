import type {
  Task,
  PMResult,
  DevResult,
  ReviewResult,
  ExecutionResult,
  OrchestratorConfig,
  AgentRole,
  TaskStatus,
} from '../src/core/types'

describe('Core Types', () => {
  describe('Task', () => {
    test('应该接受所有合法字段', () => {
      const task: Task = {
        id: 'task-1',
        title: 'Test',
        description: 'Test desc',
        assignedTo: 'dev',
        dependencies: [],
        status: 'pending',
      }
      expect(task.id).toBe('task-1')
    })

    test('应该支持所有 assignedTo 值', () => {
      const roles: Array<Task['assignedTo']> = ['pm', 'dev', 'review']
      expect(roles).toHaveLength(3)
    })

    test('应该支持所有 status 值', () => {
      const statuses: TaskStatus[] = [
        'pending',
        'in_progress',
        'completed',
        'failed',
        'review',
        'done',
      ]
      expect(statuses).toHaveLength(6)
    })
  })

  describe('PMResult', () => {
    test('应该包含 analysis 和 tasks', () => {
      const result: PMResult = {
        analysis: '分析内容',
        tasks: [],
      }
      expect(result.analysis).toBe('分析内容')
    })
  })

  describe('DevResult', () => {
    test('应该包含 success、files、summary', () => {
      const result: DevResult = {
        success: true,
        files: ['src/test.ts'],
        summary: '完成',
      }
      expect(result.success).toBe(true)
      expect(result.files).toHaveLength(1)
    })
  })

  describe('ReviewResult', () => {
    test('应该包含 approved、issues、suggestions、summary', () => {
      const result: ReviewResult = {
        approved: false,
        issues: ['issue1'],
        suggestions: ['sug1'],
        summary: '不通过',
      }
      expect(result.approved).toBe(false)
      expect(result.issues).toHaveLength(1)
    })
  })

  describe('ExecutionResult', () => {
    test('应该包含完整的执行结果结构', () => {
      const task: Task = {
        id: 't1',
        title: 'T',
        description: 'D',
        assignedTo: 'dev',
        dependencies: [],
        status: 'done',
      }

      const result: ExecutionResult = {
        success: true,
        tasks: [task],
        results: [{
          task,
          files: ['src/a.ts'],
          review: {
            approved: true,
            issues: [],
            suggestions: [],
            summary: '通过',
          },
        }],
        summary: '完成',
      }

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(1)
    })
  })

  describe('OrchestratorConfig', () => {
    test('应该接受可选配置', () => {
      const config: OrchestratorConfig = {}
      expect(config).toBeDefined()

      const fullConfig: OrchestratorConfig = {
        projectPath: '/project',
        thinking: 'high',
        model: 'glm-5',
      }
      expect(fullConfig.projectPath).toBe('/project')
    })
  })

  describe('AgentRole', () => {
    test('应该只有 pm、dev、review 三个角色', () => {
      const roles: AgentRole[] = ['pm', 'dev', 'review']
      expect(roles).toHaveLength(3)
    })
  })
})
