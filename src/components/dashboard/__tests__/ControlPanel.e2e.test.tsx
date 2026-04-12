/**
 * ControlPanel E2E Flow Tests
 *
 * 覆盖缺失的 flow #1：
 *   ControlPanel 点击"触发任务" → fetch POST /api/chat → loading 状态 → 成功后回传 taskId
 *
 * TDD: 先写测试，实现后通过。
 * 当前行为（改前）：点击 → 直接调 onTriggerTask(description)，不调 /api/chat
 * 期望行为（改后）：点击 → fetch /api/chat → loading=true → 完成后调 onTriggerTask(taskId)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ControlPanel } from '../ControlPanel'
import { GameEvent } from '@/game/types/GameEvents'

// ── Mock fetch ────────────────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function noop() {}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ControlPanel → /api/chat E2E flow', () => {
  it('点击预设任务按钮后应向 /api/chat 发送 POST 请求，包含 message 字段', async () => {
    mockFetch.mockResolvedValueOnce(makeChatResponse())
    const onTriggerTask = jest.fn()

    render(<ControlPanel onSendEvent={noop as (e: GameEvent) => void} onTriggerTask={onTriggerTask} />)

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
    // Never resolves during this check
    mockFetch.mockReturnValueOnce(new Promise(() => {}))
    const onTriggerTask = jest.fn()

    render(<ControlPanel onSendEvent={noop as (e: GameEvent) => void} onTriggerTask={onTriggerTask} />)

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    // Use act to flush the synchronous state update (setIsTriggering(true))
    act(() => { fireEvent.click(btn) })

    // After click, the buttons should show loading state
    await waitFor(() => {
      // When isTriggering=true, all task buttons show "⏳ 触发中..." text
      const loadingElements = screen.queryAllByText(/⏳/)
      expect(loadingElements.length).toBeGreaterThan(0)
    })
  })

  it('/api/chat 成功后应以 taskId 调用 onTriggerTask', async () => {
    mockFetch.mockResolvedValueOnce(makeChatResponse({ taskId: 'task-xyz' }))
    const onTriggerTask = jest.fn()

    render(<ControlPanel onSendEvent={noop as (e: GameEvent) => void} onTriggerTask={onTriggerTask} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(onTriggerTask).toHaveBeenCalledWith(
        expect.stringContaining('task-'),
      )
    })
  })

  it('/api/chat 失败时应显示错误提示，不调用 onTriggerTask', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) })
    const onTriggerTask = jest.fn()

    render(<ControlPanel onSendEvent={noop as (e: GameEvent) => void} onTriggerTask={onTriggerTask} />)

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'))
    })

    await waitFor(() => {
      expect(onTriggerTask).not.toHaveBeenCalled()
      // Should show some error feedback
      expect(screen.queryByText(/失败|error|错误/i)).not.toBeNull()
    })
  })

  it('随机任务按钮也应触发 /api/chat 调用', async () => {
    mockFetch.mockResolvedValueOnce(makeChatResponse())

    render(<ControlPanel onSendEvent={noop as (e: GameEvent) => void} onTriggerTask={jest.fn()} />)

    await act(async () => {
      fireEvent.click(screen.getByText(/随机任务/))
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.any(Object))
  })

  it('请求进行中再次点击不应重复发送', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves

    render(<ControlPanel onSendEvent={noop as (e: GameEvent) => void} onTriggerTask={jest.fn()} />)

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(btn)

    // Only one fetch call despite multiple clicks
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
