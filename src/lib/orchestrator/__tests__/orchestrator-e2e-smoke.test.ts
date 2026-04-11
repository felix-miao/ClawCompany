/**
 * E2E Smoke Test: PM → Dev → Review happy-path workflow
 *
 * Uses Orchestrator DI constructor to inject all mocked dependencies,
 * avoiding the global-singleton mocking pattern that pollutes other test suites.
 */

import { Orchestrator, OrchestratorDependencies } from '../index'
import { AgentManager } from '@/lib/agents/manager'
import { TaskManager } from '@/lib/tasks/manager'
import { ChatManager } from '@/lib/chat/manager'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import type { Task, AgentResponse, AgentContext } from '@/lib/core/types'
import type { ReviewPipelineResult } from '@/lib/core/base-orchestrator'

// ─── Mock heavy external modules ────────────────────────────────────────────
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
  buildDPScoreRecord: jest.fn(() => ({ dp_score: 80, critic_score: 80 })),
}))
// Disable shadow-git snapshots in tests (no git on CI)
jest.mock('@/lib/tasks/file-snapshot-manager', () => ({
  FileSnapshotManager: {
    forProject: () => ({
      init: jest.fn(),
      snapshot: jest.fn().mockReturnValue('abc1234'),
      rollback: jest.fn(),
      listHistory: jest.fn().mockReturnValue([]),
    }),
  },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-' + Math.random().toString(36).slice(2, 9),
    title: 'Test Task',
    description: 'Test Description',
    assignedTo: 'dev',
    dependencies: [],
    files: [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function successResponse(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    message: 'Done',
    tasks: [],
    files: [],
    status: 'success',
    ...overrides,
  }
}

function buildDeps(
  executeAgentFn: jest.Mock,
  executeReviewPipelineFn: jest.Mock,
  writeFileFn: jest.Mock,
): OrchestratorDependencies {
  let taskCounter = 0
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
      const t = makeTask({ id: `task-${++taskCounter}`, title, description: desc, assignedTo: assignedTo as Task['assignedTo'], dependencies: deps, files })
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
    clearTasks: jest.fn(() => { taskStore.clear(); allTasks.length = 0 }),
    getStats: jest.fn(() => ({ total: 0, pending: 0, in_progress: 0, review: 0, done: 0 })),
  } as unknown as TaskManager

  const chatMgr = {
    sendUserMessage: jest.fn(),
    broadcast: jest.fn(),
    getHistory: jest.fn().mockReturnValue([]),
    clearHistory: jest.fn(),
  } as unknown as ChatManager

  const sandboxWriter = {
    writeFile: writeFileFn,
    readFile: jest.fn().mockResolvedValue(null),
    validatePath: jest.fn().mockReturnValue({ allowed: true }),
    validateContent: jest.fn().mockReturnValue({ allowed: true }),
    readAllowed: jest.fn().mockReturnValue(true),
    getSandboxDir: jest.fn().mockReturnValue('/tmp'),
    getAllowedExtensions: jest.fn().mockReturnValue(['.ts', '.js']),
  } as unknown as SandboxedFileWriter

  return { agentManager: agentMgr, taskManager: taskMgr, chatManager: chatMgr, sandboxedWriter: sandboxWriter }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Orchestrator E2E Smoke Test — PM → Dev → Review happy path', () => {
  it('should complete successfully: PM plans → Dev implements → Review approves', async () => {
    const savedFiles: string[] = []
    const executeAgent = jest.fn()
    const writeFile = jest.fn().mockImplementation(async (filePath: string) => {
      savedFiles.push(filePath)
      return { success: true }
    })

    // PM response: generates one dev subtask
    const pmResponse: AgentResponse = {
      message: 'PM Analysis: implement hello world',
      tasks: [
        { title: 'Implement hello.ts', description: 'Write hello world function', assignedTo: 'dev', dependencies: [], files: ['src/hello.ts'] },
      ],
      files: [],
      status: 'success',
    }

    // Dev response: produces a file
    const devResponse: AgentResponse = {
      message: 'Dev: implemented hello.ts',
      tasks: [],
      files: [{ path: 'src/hello.ts', content: 'export function hello() { return "Hello World" }' }],
      status: 'success',
    }

    // Review response: approved
    const reviewPipelineResult: ReviewPipelineResult = {
      reviewResult: successResponse({ message: 'LGTM' }),
      daTriggered: false,
    }

    executeAgent.mockImplementation(async (role: string) => {
      if (role === 'pm') return pmResponse
      if (role === 'dev') return devResponse
      return successResponse()
    })

    const executeReviewPipeline = jest.fn().mockResolvedValue(reviewPipelineResult)

    const deps = buildDeps(executeAgent, executeReviewPipeline, writeFile)
    const orchestrator = new Orchestrator('test', { maxRetries: 1, initialDelay: 0 }, undefined, undefined, deps)

    const result = await orchestrator.executeUserRequest('Add a hello world function')

    // ── Assertions ──────────────────────────────────────────
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()

    // PM was called
    expect(executeAgent).toHaveBeenCalledWith('pm', expect.any(Object), expect.any(Object))
    // Dev was called
    expect(executeAgent).toHaveBeenCalledWith('dev', expect.any(Object), expect.any(Object))
    // Review pipeline was called
    expect(executeReviewPipeline).toHaveBeenCalled()
    // File was saved
    expect(savedFiles).toContain('src/hello.ts')
    expect(result.files?.some(f => f.path === 'src/hello.ts')).toBe(true)
  })
})
