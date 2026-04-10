import { OpenClawAgentExecutor, AgentExecutionResult } from '../executor'
import { OpenClawGatewayClient } from '../client'

jest.mock('../client', () => ({
  OpenClawGatewayClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(true),
    sessions_spawn: jest.fn(),
    sessions_history: jest.fn(),
    waitForCompletion: jest.fn(),
    sessions_send: jest.fn(),
    call: jest.fn(),
  })),
  getGatewayClient: jest.fn()
}))

describe('OpenClawAgentExecutor.sendToAgent', () => {
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

  it('should send message to agent by role', async () => {
    await executor.connect()

    mockClient.call.mockResolvedValueOnce([
      { key: 'agent:sidekick-claw:session:abc', status: 'running' },
      { key: 'agent:dev-claw:session:def', status: 'running' },
    ])

    mockClient.sessions_send.mockResolvedValueOnce({
      status: 'sent',
      messageId: 'msg-123',
    })

    const result = await executor.sendToAgent('dev', 'Please implement this feature')

    expect(result.success).toBe(true)
    expect(mockClient.sessions_send).toHaveBeenCalledWith(
      'agent:dev-claw:session:def',
      'Please implement this feature'
    )
  })

  it('should return error when no active session found for role', async () => {
    await executor.connect()

    mockClient.call.mockResolvedValueOnce([])

    const result = await executor.sendToAgent('dev', 'Hello')

    expect(result.success).toBe(false)
    expect(result.error).toContain('No active session')
  })

  it('should return error when not connected', async () => {
    mockClient.call.mockRejectedValue(new Error('Connection refused'))

    const result = await executor.sendToAgent('dev', 'Hello')

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('should map role names to session key patterns', async () => {
    await executor.connect()

    mockClient.call.mockResolvedValueOnce([
      { key: 'agent:sidekick-claw:session:pm1', status: 'running' },
    ])

    mockClient.sessions_send.mockResolvedValueOnce({
      status: 'sent',
      messageId: 'msg-456',
    })

    const result = await executor.sendToAgent('pm', 'Analyze this')

    expect(result.success).toBe(true)
    expect(mockClient.sessions_send).toHaveBeenCalledWith(
      'agent:sidekick-claw:session:pm1',
      'Analyze this'
    )
  })
})
