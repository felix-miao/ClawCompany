import { DevAgent } from '../dev-agent'
import { Task, AgentContext } from '../types'
import { OpenClawAgentExecutor } from '../../gateway/executor'

jest.mock('../../gateway/executor', () => ({
  getAgentExecutor: jest.fn(),
  OpenClawAgentExecutor: jest.fn()
}))

describe('DevAgent parseOpenClawResponse edge cases', () => {
  let devAgent: DevAgent
  let mockTask: Task
  let mockContext: AgentContext
  let mockExecutor: jest.Mocked<OpenClawAgentExecutor>

  beforeEach(() => {
    mockExecutor = {
      connect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      executeDevAgent: jest.fn()
    } as unknown as jest.Mocked<OpenClawAgentExecutor>

    devAgent = new DevAgent({ mode: 'openclaw', executor: mockExecutor })

    mockTask = {
      id: 'test-1',
      title: 'test task',
      description: 'test desc',
      status: 'pending',
      assignedTo: 'dev',
      dependencies: [],
      files: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    mockContext = {
      projectId: 'test',
      tasks: [],
      files: {},
      chatHistory: []
    }
  })

  it('should handle JSON files with missing path (defaults to unknown.ts)', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: '```json\n{"files":[{"content":"code"}]}\n```'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files).toHaveLength(1)
    expect(response.files![0].path).toBe('unknown.ts')
    expect(response.files![0].content).toBe('code')
  })

  it('should handle JSON files with missing content (defaults to empty string)', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: '```json\n{"files":[{"path":"src/test.ts"}]}\n```'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files).toHaveLength(1)
    expect(response.files![0].content).toBe('')
  })

  it('should handle JSON files with missing action (defaults to create)', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: '```json\n{"files":[{"path":"src/a.ts","content":"x"}]}\n```'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files![0].action).toBe('create')
  })

  it('should handle JSON files with explicit modify action', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: '```json\n{"files":[{"path":"src/a.ts","content":"x","action":"modify"}]}\n```'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files![0].action).toBe('modify')
  })

  it('should handle empty files array in JSON', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: '```json\n{"files":[],"message":"no files needed"}\n```'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files).toHaveLength(0)
    expect(response.message).toBe('no files needed')
  })

  it('should handle JSON without files field (defaults to empty array)', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: '```json\n{"message":"just a message"}\n```'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files).toHaveLength(0)
    expect(response.message).toBe('just a message')
  })

  it('should handle non-JSON code blocks and extract them', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: 'Here is the code:\n```tsx\nexport default function X() {}\n```\nDone'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files).toHaveLength(1)
    expect(response.files![0].path).toMatch(/\.tsx$/)
    expect(response.files![0].content).toContain('export default function X()')
  })

  it('should handle non-parseable response gracefully', async () => {
    mockExecutor.executeDevAgent.mockResolvedValue({
      success: true,
      content: 'This is just plain text without any code'
    })

    const response = await devAgent.execute(mockTask, mockContext)
    expect(response.files).toHaveLength(0)
    expect(response.message).toBe('This is just plain text without any code')
  })
})
