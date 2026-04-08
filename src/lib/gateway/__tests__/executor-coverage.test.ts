import { OpenClawAgentExecutor, setAgentExecutor, createAgentExecutor, resetAgentExecutor } from '../executor'
import { OpenClawGatewayClient } from '../client'

jest.mock('../client', () => ({
  OpenClawGatewayClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    sessions_spawn: jest.fn(),
    sessions_history: jest.fn(),
    waitForCompletion: jest.fn()
  })),
  getGatewayClient: jest.fn()
}))

describe('OpenClawAgentExecutor - spawn without childSessionKey (lines 98-102)', () => {
  let executor: OpenClawAgentExecutor
  let mockClient: jest.Mocked<OpenClawGatewayClient>

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = new OpenClawGatewayClient('') as jest.Mocked<OpenClawGatewayClient>
    executor = new OpenClawAgentExecutor(mockClient)
  })

  afterEach(async () => {
    await executor.disconnect()
  })

  it('should return error when spawn accepted but no childSessionKey', async () => {
    mockClient.sessions_spawn.mockResolvedValue({
      status: 'accepted',
      runId: 'run-no-key'
    })

    const result = await executor.executeAgent('pm', 'test task')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Spawn accepted but no childSessionKey returned')
    expect(result.error).toContain('run-no-key')
  })

  it('should handle missing childSessionKey and missing runId', async () => {
    mockClient.sessions_spawn.mockResolvedValue({
      status: 'accepted'
    })

    const result = await executor.executeAgent('dev', 'test')

    expect(result.success).toBe(false)
    expect(result.error).toContain('unknown')
  })
})

describe('setAgentExecutor / createAgentExecutor', () => {
  afterEach(() => {
    resetAgentExecutor()
  })

  it('setAgentExecutor should set the singleton executor', () => {
    const mockClient = new OpenClawGatewayClient('') as jest.Mocked<OpenClawGatewayClient>
    const executor = new OpenClawAgentExecutor(mockClient)
    setAgentExecutor(executor)
    expect(setAgentExecutor).toBeDefined()
    setAgentExecutor(null)
  })

  it('createAgentExecutor should create a new executor instance', () => {
    const executor = createAgentExecutor()
    expect(executor).toBeInstanceOf(OpenClawAgentExecutor)
  })

  it('createAgentExecutor should accept a client parameter', () => {
    const mockClient = new OpenClawGatewayClient('') as jest.Mocked<OpenClawGatewayClient>
    const executor = createAgentExecutor(mockClient)
    expect(executor).toBeInstanceOf(OpenClawAgentExecutor)
  })
})
