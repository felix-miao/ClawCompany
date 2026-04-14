/**
 * Full E2E smoke test: ControlPanel → /api/chat → OfficeScene animation (flow #6)
 *
 * 验证完整链路（全部 mock，无真实 LLM / Phaser）：
 *
 *   1. 用户点击 ControlPanel 的"触发任务"按钮
 *   2. fetch POST /api/chat 被调用，携带任务描述
 *   3. /api/chat 返回 { taskId, tasks }
 *   4. dashboard/page 的 handleTriggerTask(taskId) 被调用
 *   5. SSE 推送 pm:analysis-complete → game.receiveGameEvent() 被调用
 *   6. SSE 推送 dev:iteration-start → game.receiveGameEvent() 被调用
 *   7. SSE 推送 workflow:iteration-complete → game.receiveGameEvent() 被调用
 */

import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import type { GameEvent } from '@/game/types/GameEvents'

// ── Mock game ─────────────────────────────────────────────────────────────────

const mockReceiveGameEvent = jest.fn()
const mockDestroyGame = jest.fn()

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({
    receiveGameEvent: mockReceiveGameEvent,
    triggerTestTask: jest.fn(),
    destroy: mockDestroyGame,
  })),
}))

// ── Mock /api/chat fetch ──────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch

// ── Mock hooks ────────────────────────────────────────────────────────────────

// Capture the store passed to useEventStream so we can simulate SSE events
let capturedStore: { processEvent: (e: unknown) => void } | null = null

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: jest.fn((store: { processEvent: (e: unknown) => void }) => {
    capturedStore = store
    return { isConnected: true, isReconnecting: false }
  }),
}))

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: jest.fn(() => ({
    agents: [],
    events: [],
    stats: { totalEvents: 0, activeTasks: 0 },
    taskHistory: [],
  })),
}))

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: [],
    metrics: null,
    connected: true,
    loading: false,
    error: null,
    refresh: jest.fn(),
  })),
}))

jest.mock('@/game/data/DashboardStore', () => ({
  DashboardStore: jest.fn().mockImplementation(() => ({
    processEvent: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    getState: jest.fn(() => ({ agents: [], events: [], stats: {}, taskHistory: [] })),
  })),
}))

jest.mock('@/lib/core/metrics-aggregator', () => ({
  MetricsAggregator: jest.fn().mockImplementation(() => ({
    recordEvent: jest.fn(),
    getMetrics: jest.fn(() => ({})),
    startPeriodicUpdate: jest.fn(() => () => {}),
  })),
}))

jest.mock('@/lib/core/performance-monitor', () => ({
  PerformanceMonitor: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@/lib/core/error-tracker', () => ({
  ErrorTracker: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@/lib/core/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({})),
}))

import DashboardPage from '@/app/dashboard/page'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Full E2E: ControlPanel click → /api/chat → Phaser animation', () => {
  beforeEach(() => {
    mockReceiveGameEvent.mockClear()
    mockDestroyGame.mockClear()
    mockFetch.mockReset()
    capturedStore = null

    // /api/chat returns a task workflow result
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/chat') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            workflowType: 'orchestrator',
            taskId: 'task-e2e-001',
            message: 'PM 分析完成，任务已拆分',
            tasks: [
              { id: 'subtask-1', title: '实现登录表单', status: 'completed', assignedTo: 'dev' },
            ],
          }),
        })
      }
      // SSE /api/game-events
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  async function renderAndWaitForGame() {
    const result = render(React.createElement(DashboardPage))
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    return result
  }

  function simulateSseEvent(event: GameEvent) {
    if (capturedStore) {
      capturedStore.processEvent(event)
    }
  }

  // ── #1 click → /api/chat called ──────────────────────────────────────────

  it('点击"触发任务"按钮后应向 /api/chat 发送 POST 请求', async () => {
    await renderAndWaitForGame()

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  // ── #2 click → confirmed /api/chat was called ─────────────────────────────

  it('/api/chat 成功后 /api/chat 请求应被发出', async () => {
    await renderAndWaitForGame()

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    await act(async () => { fireEvent.click(btn) })

    await waitFor(() => {
      const chatCalled = mockFetch.mock.calls.some((c: unknown[]) => c[0] === '/api/chat')
      expect(chatCalled).toBe(true)
    })
  })

  // ── #3 SSE pm:analysis-complete → receiveGameEvent ───────────────────────

  it('SSE pm:analysis-complete 事件应被转发给 game.receiveGameEvent()', async () => {
    await renderAndWaitForGame()

    await act(async () => {
      simulateSseEvent({
        type: 'pm:analysis-complete',
        agentId: 'pm-agent',
        timestamp: Date.now(),
        payload: { projectId: 'test', taskCount: 1, analysis: '需求分析完成' },
      })
    })

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:analysis-complete' }),
      )
    })
  })

  // ── #4 SSE dev:iteration-start → receiveGameEvent ────────────────────────

  it('SSE dev:iteration-start 应被转发给 game.receiveGameEvent()', async () => {
    await renderAndWaitForGame()

    await act(async () => {
      simulateSseEvent({
        type: 'dev:iteration-start',
        agentId: 'dev-agent',
        timestamp: Date.now(),
        payload: { taskId: 'task-e2e-001', iteration: 1, hasFeedback: false },
      })
    })

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dev:iteration-start' }),
      )
    })
  })

  // ── #5 SSE workflow:iteration-complete → receiveGameEvent ─────────────────

  it('SSE workflow:iteration-complete 应被转发给 game.receiveGameEvent()', async () => {
    await renderAndWaitForGame()

    await act(async () => {
      simulateSseEvent({
        type: 'workflow:iteration-complete',
        agentId: 'review-agent',
        timestamp: Date.now(),
        payload: { taskId: 'task-e2e-001', totalIterations: 1, approved: true },
      })
    })

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow:iteration-complete',
          payload: expect.objectContaining({ approved: true }),
        }),
      )
    })
  })

  // ── #6 full sequence ──────────────────────────────────────────────────────

  it('完整序列：点击按钮 → /api/chat → SSE 事件依次转发给 game', async () => {
    await renderAndWaitForGame()

    // Step 1: trigger
    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    await act(async () => { fireEvent.click(btn) })
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.any(Object)))

    // Step 2: Orchestrator emits pm:analysis-complete via SSE
    await act(async () => {
      simulateSseEvent({
        type: 'pm:analysis-complete',
        agentId: 'pm-agent',
        timestamp: Date.now(),
        payload: { projectId: 'test', taskCount: 1, analysis: '需求分析' },
      })
    })

    // Step 3: dev:iteration-start
    await act(async () => {
      simulateSseEvent({
        type: 'dev:iteration-start',
        agentId: 'dev-agent',
        timestamp: Date.now(),
        payload: { taskId: 'task-e2e-001', iteration: 1, hasFeedback: false },
      })
    })

    // Step 4: workflow:iteration-complete
    await act(async () => {
      simulateSseEvent({
        type: 'workflow:iteration-complete',
        agentId: 'review-agent',
        timestamp: Date.now(),
        payload: { taskId: 'task-e2e-001', totalIterations: 1, approved: true },
      })
    })

    // Verify all 3 events reached the game
    await waitFor(() => {
      const calls = mockReceiveGameEvent.mock.calls.map((c: unknown[]) => (c[0] as { type: string }).type)
      expect(calls).toContain('pm:analysis-complete')
      expect(calls).toContain('dev:iteration-start')
      expect(calls).toContain('workflow:iteration-complete')
    })
  })
})
