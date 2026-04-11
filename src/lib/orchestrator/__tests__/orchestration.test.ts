/**
 * E2E Test: PM → Dev → QC workflow with mocked LLM
 *
 * Tests the full orchestration pipeline with deterministic LLM mocking.
 * Validates task creation, agent execution, and review flow.
 */

import { Orchestrator, OrchestratorDependencies } from '../index'
import { AgentManager } from '@/lib/agents/manager'
import { TaskManager } from '@/lib/tasks/manager'
import { ChatManager } from '@/lib/chat/manager'
import { SandboxedFileWriter } from '@/lib/security/sandbox'
import type { Task, AgentResponse } from '@/lib/core/types'
import type { ReviewPipelineResult } from '@/lib/core/base-orchestrator'

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
jest.mock('@/lib/tasks/file-snapshot-manager', () => ({
  FileSnapshotManager: {
    forProject: () => ({
      init: jest.fn(),
      snapshot: jest.fn().mockReturnValue('snap-123'),
      rollback: jest.fn(),
      listHistory: jest.fn().mockReturnValue([]),
    }),
  },
}))

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
    getAllowedExtensions: jest.fn().mockReturnValue(['.ts']),
  } as unknown as SandboxedFileWriter

  return { agentManager: agentMgr, taskManager: taskMgr, chatManager: chatMgr, sandboxedWriter: sandboxWriter }
}

describe('Orchestrator - PM → Dev → QC Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should complete PM → Dev → Review workflow with success', async () => {
    const executeAgent = jest.fn()
    const executeReviewPipeline = jest.fn()
    const writeFile = jest.fn().mockResolvedValue({ success: true })

    const pmResponse: AgentResponse = {
      message: 'PM: created dev task',
      tasks: [{ title: 'Implement feature', description: 'Add login functionality', assignedTo: 'dev', dependencies: [], files: [] }],
      files: [],
      status: 'success',
    }

    const devResponse: AgentResponse = {
      message: 'Dev: implemented feature',
      tasks: [],
      files: [{ path: 'src/login.ts', content: 'export const login = () => {}', action: 'create' }],
      status: 'success',
    }

    const reviewResponse: ReviewPipelineResult = {
      reviewResult: { message: 'LGTM', tasks: [], files: [], status: 'success' },
      daTriggered: false,
    }

    executeAgent.mockImplementation(async (role: string) => {
      if (role === 'pm') return pmResponse
      if (role === 'dev') return devResponse
      return { message: 'done', tasks: [], files: [], status: 'success' }
    })

    executeReviewPipeline.mockResolvedValue(reviewResponse)

    const deps = buildDeps(executeAgent, executeReviewPipeline, writeFile)
    const orchestrator = new Orchestrator('test-pm-dev-qc', { maxRetries: 1, initialDelay: 0 }, undefined, undefined, deps)

    const result = await orchestrator.executeUserRequest('Add login feature')

    expect(result.success).toBe(true)
    expect(executeAgent).toHaveBeenCalledTimes(2)
    expect(executeReviewPipeline).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
  })

  it('should retry dev on review rejection', async () => {
    const executeAgent = jest.fn()
    const executeReviewPipeline = jest.fn()
    const writeFile = jest.fn().mockResolvedValue({ success: true })

    const pmResponse: AgentResponse = {
      message: 'PM: created task',
      tasks: [{ title: 'Fix bug', description: 'Fix memory leak', assignedTo: 'dev', dependencies: [], files: [] }],
      files: [],
      status: 'success',
    }

    const devResponse: AgentResponse = {
      message: 'Dev: attempted fix',
      tasks: [],
      files: [{ path: 'src/memory.ts', content: 'let cache = new Map()', action: 'create' }],
      status: 'success',
    }

    executeAgent.mockImplementation(async (role: string) => {
      if (role === 'pm') return pmResponse
      if (role === 'dev') return devResponse
      return { message: 'done', tasks: [], files: [], status: 'success' }
    })

    executeReviewPipeline
      .mockResolvedValueOnce({
        reviewResult: { message: 'REJECT: memory still leaking', tasks: [], files: [], status: 'error' },
        daTriggered: false,
      })
      .mockResolvedValueOnce({
        reviewResult: { message: 'LGTM', tasks: [], files: [], status: 'success' },
        daTriggered: false,
      })

    const deps = buildDeps(executeAgent, executeReviewPipeline, writeFile)
    const orchestrator = new Orchestrator('test-retry', { maxRetries: 1, initialDelay: 0 }, undefined, undefined, deps)

    const result = await orchestrator.executeUserRequest('Fix memory leak')

    expect(result.success).toBe(true)
    expect(executeReviewPipeline).toHaveBeenCalledTimes(2)
  })

  it('should handle multiple dependent tasks correctly', async () => {
    const executeAgent = jest.fn()
    const executeReviewPipeline = jest.fn()
    const writeFile = jest.fn().mockResolvedValue({ success: true })

    const pmResponse: AgentResponse = {
      message: 'PM: created 3 tasks with dependencies',
      tasks: [
        { title: 'Setup', description: 'Initialize project', assignedTo: 'dev', dependencies: [], files: [] },
        { title: 'Component', description: 'Create UI component', assignedTo: 'dev', dependencies: [], files: [] },
        { title: 'Integration', description: 'Wire up component', assignedTo: 'dev', dependencies: [], files: [] },
      ],
      files: [],
      status: 'success',
    }

    executeAgent.mockImplementation(async (role: string) => {
      if (role === 'pm') return pmResponse
      return { message: 'done', tasks: [], files: [], status: 'success' }
    })

    executeReviewPipeline.mockResolvedValue({
      reviewResult: { message: 'LGTM', tasks: [], files: [], status: 'success' },
      daTriggered: false,
    })

    const deps = buildDeps(executeAgent, executeReviewPipeline, writeFile)
    const orchestrator = new Orchestrator('test-deps', { maxRetries: 1, initialDelay: 0 }, undefined, undefined, deps)

    const result = await orchestrator.executeUserRequest('Build full feature')

    expect(result.success).toBe(true)
    expect(result.stats?.totalTasks).toBe(3)
  })
})