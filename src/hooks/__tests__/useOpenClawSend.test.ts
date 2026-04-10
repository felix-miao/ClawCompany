import { renderHook, act } from '@testing-library/react'

import { useOpenClawSend } from '../../hooks/useOpenClawSend'

describe('useOpenClawSend', () => {
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should have correct initial state', () => {
    const { result } = renderHook(() => useOpenClawSend())

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.lastResult).toBeNull()
  })

  it('should send message successfully', async () => {
    const mockResult = { status: 'sent', messageId: 'msg-123' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: mockResult }),
    })

    const { result } = renderHook(() => useOpenClawSend())

    await act(async () => {
      await result.current.sendToAgent('agent:main:subagent:abc', 'Hello')
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.lastResult).toEqual(mockResult)
    expect(mockFetch).toHaveBeenCalledWith('/api/openclaw/send', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }))
  })

  it('should handle send failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Gateway error' }),
    })

    const { result } = renderHook(() => useOpenClawSend())

    await act(async () => {
      await result.current.sendToAgent('agent:main:subagent:abc', 'Hello')
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Gateway error')
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useOpenClawSend())

    await act(async () => {
      await result.current.sendToAgent('agent:main:subagent:abc', 'Hello')
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Network error')
  })

  it('should set loading during send', async () => {
    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise(resolve => { resolvePromise = resolve })
    mockFetch.mockReturnValue(pendingPromise)

    const { result } = renderHook(() => useOpenClawSend())

    act(() => {
      result.current.sendToAgent('agent:main:subagent:abc', 'Hello')
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, result: { status: 'sent' } }),
      })
    })

    expect(result.current.loading).toBe(false)
  })
})
