jest.mock('@/lib/core/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}))

const originalNodeEnv = process.env.NODE_ENV
const originalDiag = process.env.OPENCLAW_EVENTSTORE_DIAG

function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  })
}

describe('GameEventStore dev diagnostics noise', () => {
  beforeEach(() => {
    jest.resetModules()
    delete globalThis.__diagTimerStarted
    delete globalThis.__gameEventEmitter
    delete process.env.OPENCLAW_EVENTSTORE_DIAG
    setNodeEnv('development')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalDiag === undefined) delete process.env.OPENCLAW_EVENTSTORE_DIAG
    else process.env.OPENCLAW_EVENTSTORE_DIAG = originalDiag
    setNodeEnv(originalNodeEnv)
    delete globalThis.__diagTimerStarted
    delete globalThis.__gameEventEmitter
  })

  it('does not start the development diagnostic interval by default', async () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval')

    await import('../GameEventStore')

    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(globalThis.__diagTimerStarted).toBeUndefined()
  })

  it('keeps diagnostic interval opt-in for targeted leak debugging', async () => {
    process.env.OPENCLAW_EVENTSTORE_DIAG = '1'
    const timer = { unref: jest.fn() }
    const setIntervalSpy = jest
      .spyOn(globalThis, 'setInterval')
      .mockReturnValue(timer as never)

    await import('../GameEventStore')

    expect(setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(globalThis.__diagTimerStarted).toBe(true)
    expect(timer.unref).toHaveBeenCalled()
  })
})
