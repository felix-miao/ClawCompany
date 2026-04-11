/**
 * E2E Test: Review REJECT flow with rollback verification
 *
 * Verifies that when Review rejects the first two iterations:
 * 1. FileSnapshotManager.rollback is called after each rejection
 * 2. On the 3rd iteration, Review approves → workflow succeeds
 */

import { Orchestrator, OrchestratorDependencies } from '../index'
import { AgentManager } from '@/lib/agents/manager'
import { TaskManager } from '@/lib/tasks/manager'
import { ChatManager } from '@/lib/chat/manager'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import type { Task, AgentResponse } from '@/lib/core/types'
import type { ReviewPipelineResult } from '@/lib/core/base-orchestrator'

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/llm/anthropic', () => ({}))
jest.mock('@/lib/tasks/checkpoint-service', () => ({
  CheckpointService: {
    getInstance: () => ({
      saveInitial: jest.fn(),
      savePMComplete: jest.fn(),
      saveDevComplete: jest.fn(),
      saveReviewComplete: jest.fn(),
      saveCompleted: jest.fn(),
      saveError: jest.fn(),
    }),
  },
}))
jest.mock('@/game/data/GameEventStore', () => ({
  getGameEventStore: () => ({ push: jest.fn() }),
}))
jest.mock('@/lib/analytics/dp-score-store', () => ({
  DPScoreStore: { getInstance: () => ({ save: jest.fn() }) },
  buildDPScoreRecord: jest.fn(() => ({ dp_score: 60, critic_score: 60 })),
}))

// ─── Capture rollback calls ───────────────────────────────────────────────────
const mockSnapshot = jest.fn().mockReturnValue('snap001')
const mockRollback = jest.fn()
const mockInit = jest.fn()

jest.mock('@/lib/tasks/file-snapshot-manager', () => ({
  FileSnapshotManager: {
    forProject: () => ({
      init: mockInit,
      snapshot: mockSnapshot,
      rollback: mockRollback,
      listHistory: jest.fn().mockReturnValue([]),
    }),
  },
}))

// ─── Helper builders ─────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-' + Math.random().toString(36).slice(2, 9),
    title: 'Test Task',
    description: 'Test',
    assignedTo: 'dev',
    dependencies: [],
    files: [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function buildDeps(
  executeAgentFn: jest.Mock,
  executeReviewPipelineFn: jest.Mock,
): OrchestratorDependencies {
  let counter = 0
  const taskStore = new Map<string, Task>()
  const allTasks: Task[] = []

  const agentMgr = {
    executeAgent: executeAgentFn,
    executeReviewPipeline: executeReviewPipelineFn,
    getAgent: jest.fn(),
    getAllAgents: jest.fn().mockReturnValue([]),
    getAgentInfo: jest.fn(),
    recordDAGateStat: jest.fn(),
    agents: new Map(),
    arbiter: {},
  } as unknown as AgentManager

  const taskMgr = {
    createTask: jest.fn((title: string, desc: string, assignedTo: string, deps: string[], files: string[]) => {
      const t = makeTask({ id: `task-${++counter}`, title, description: desc, assignedTo: assignedTo as Task['assignedTo'], dependencies: deps, files })
      taskStore.set(t.id, t)
      allTasks.push(t)
      return t
    }),
    getTask: jest.fn((id: string) => taskStore.get(id)),
    updateTaskStatus: jest.fn((id: string, status: Task['status']) => {
      const t = taskStore.get(id)
      if (t) t.status = status
    }),
    getAllTasks: jest.fn(() => allTasks),
    clearTasks: jest.fn(),
    getStats: jest.fn(() => ({ total: 0, pending: 0, in_progress: 0, review: 0, done: 0 })),
  } as unknown as TaskManager

  const chatMgr = {
    sendUserMessage: jest.fn(),
    broadcast: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    clearHistory: jest.fn(),
  } as unknown as ChatManager

  const sandboxWriter = {
    writeFile: jest.fn().mockResolvedValue({ success: true }),
    readFile: jest.fn().mockResolvedValue(null),
    validatePath: jest.fn().mockReturnValue({ allowed: true }),
    validateContent: jest.fn().mockReturnValue({ allowed: true }),
    readAllowed: jest.fn().mockReturnValue(true),
    getSandboxDir: jest.fn().mockReturnValue('/tmp'),
    getAllowedExtensions: jest.fn().mockReturnValue(['.ts']),
  } as unknown as SandboxedFileWriter

  return { agentManager: agentMgr, taskManager: taskMgr, chatManager: chatMgr, sandboxedWriter: sandboxWriter }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Orchestrator E2E — Review REJECT with rollback', () => {
  beforeEach(() => {
    mockSnapshot.mockClear()
    mockRollback.mockClear()
    mockInit.mockClear()
  })

  it('should rollback after each rejection and succeed on the 3rd review approval', async () => {
    const executeAgent = jest.fn()
    let reviewCallCount = 0

    const pmResponse: AgentResponse = {
      message: 'PM: one dev task',
      tasks: [{ title: 'Fix bug', description: 'Fix the bug', assignedTo: 'dev', dependencies: [], files: [] }],
      files: [],
      status: 'success',
    }

    const devResponse: AgentResponse = {
      message: 'Dev: fixed',
      tasks: [],
      files: [{ path: 'src/fix.ts', content: 'export const fix = () => {}', action: 'modify' as const }],
      status: 'success',
    }

    executeAgent.mockImplementation(async (role: string) => {
      if (role === 'pm') return pmResponse
      if (role === 'dev') return devResponse
      return { message: 'ok', tasks: [], files: [], status: 'success' }
    })

    const executeReviewPipeline = jest.fn().mockImplementation(async (): Promise<ReviewPipelineResult> => {
      reviewCallCount++
      if (reviewCallCount <= 2) {
        // First two reviews REJECT
        return {
          reviewResult: { message: 'REJECT: needs improvement', tasks: [], files: [], status: 'error' },
          daTriggered: false,
        }
      }
      // Third review APPROVES
      return {
        reviewResult: { message: 'LGTM — approved', tasks: [], files: [], status: 'success' },
        daTriggered: false,
      }
    })

    const deps = buildDeps(executeAgent, executeReviewPipeline)
    const orchestrator = new Orchestrator('test-reject', { maxRetries: 1, initialDelay: 0 }, undefined, undefined, deps)

    const result = await orchestrator.executeUserRequest('Fix the bug')

    // Workflow should ultimately succeed
    expect(result.success).toBe(true)

    // Review was called 3 times (2 rejects + 1 approve)
    expect(reviewCallCount).toBe(3)

    // Dev was called 3 times (once per iteration)
    const devCalls = executeAgent.mock.calls.filter(([role]) => role === 'dev')
    expect(devCalls.length).toBe(3)

    // snapshot was taken before each dev iteration (3 times)
    expect(mockSnapshot).toHaveBeenCalledTimes(3)

    // rollback was called after each rejection (2 times)
    expect(mockRollback).toHaveBeenCalledTimes(2)
    expect(mockRollback).toHaveBeenCalledWith('snap001')
  })

  it('should rollback and fail after MAX_ITERATIONS rejections', async () => {
    const executeAgent = jest.fn()

    executeAgent.mockImplementation(async (role: string) => {
      if (role === 'pm') {
        return {
          message: 'PM',
          tasks: [{ title: 'Task', description: 'Desc', assignedTo: 'dev', dependencies: [], files: [] }],
          files: [],
          status: 'success',
        }
      }
      return { message: 'Dev done', tasks: [], files: [], status: 'success' }
    })

    // Always reject
    const executeReviewPipeline = jest.fn().mockResolvedValue({
      reviewResult: { message: 'Always reject', tasks: [], files: [], status: 'error' },
      daTriggered: false,
    } as ReviewPipelineResult)

    const deps = buildDeps(executeAgent, executeReviewPipeline)
    const orchestrator = new Orchestrator('test-max', { maxRetries: 1, initialDelay: 0 }, undefined, undefined, deps)

    const result = await orchestrator.executeUserRequest('Impossible task')

    // Should fail after MAX_ITERATIONS (3)
    expect(result.success).toBe(false)
    expect(result.failedTasks?.length).toBeGreaterThan(0)

    // Rollback on the final failed iteration
    expect(mockRollback).toHaveBeenCalled()
  })
})
