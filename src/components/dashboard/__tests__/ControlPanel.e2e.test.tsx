import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { ControlPanel } from '../ControlPanel'

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

function makeChatResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      workflowType: 'orchestrator',
      message: 'PM 分析完成，任务已拆分',
      taskId: 'task-abc123',
      tasks: [
        { id: 'subtask-1', title: '实现登录表单', status: 'completed', assignedTo: 'dev' },
      ],
      ...overrides,
    }),
  }
}

describe('ControlPanel -> /api/chat E2E flow', () => {
  it('点击预设任务按钮后应向 /api/chat 发送 POST 请求，包含 message 字段', async () => {
    mockFetch.mockResolvedValueOnce(makeChatResponse())
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    await act(async () => { fireEvent.click(btn) })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: expect.stringContaining('Next.js'),
      }),
    )
  })

  it('请求发送中按钮应处于 disabled / loading 状态', async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    act(() => { fireEvent.click(btn) })

    await waitFor(() => {
      const loadingElements = screen.queryAllByText(/触发中/)
      expect(loadingElements.length).toBeGreaterThan(0)
      expect(btn).toBeDisabled()
    })
  })

  it('/api/chat 成功后应以 taskId 调用 onTriggerTask', async () => {
    mockFetch.mockResolvedValueOnce(makeChatResponse({ taskId: 'task-xyz' }))
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(onTriggerTask).toHaveBeenCalledWith('task-xyz')
    })
  })

  it('/api/chat 失败时应显示错误提示，不调用 onTriggerTask', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) })
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(onTriggerTask).not.toHaveBeenCalled()
      expect(screen.queryByText(/失败|error|错误/i)).not.toBeNull()
    })
  })

  it('随机任务按钮也应触发 /api/chat 调用', async () => {
    mockFetch.mockResolvedValueOnce(makeChatResponse())

    render(<ControlPanel onTriggerTask={jest.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText(/随机任务/))
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
  })

  it('请求进行中再次点击不应重复发送', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(<ControlPanel onTriggerTask={jest.fn()} />)

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    fireEvent.click(btn)

    await waitFor(() => expect(btn).toBeDisabled())
    fireEvent.click(btn)
    fireEvent.click(btn)

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
