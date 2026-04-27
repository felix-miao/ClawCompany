/**
 * Dashboard page snapshot → Phaser EventBus bridge tests (flow #4)
 *
 * 验证：当 OpenClaw snapshot 包含 GameEvent（pm:analysis-complete / dev:iteration-start /
 * workflow:iteration-complete）时，dashboard/page.tsx 会调用
 * gameRef.current.receiveGameEvent(event)，将事件转发给 Phaser 场景。
 */

import React from 'react'
import { render, act, waitFor } from '@testing-library/react'

import DashboardPage from '../page'

import type { GameEvent } from '@/game/types/GameEvents'

// ── Mock 所有外部依赖 ─────────────────────────────────────────────────────────

const mockReceiveGameEvent = jest.fn()
const mockTriggerTestTask = jest.fn()
const mockDestroyGame = jest.fn()

jest.mock('@/game', () => ({
  startGame: jest.fn(() => ({
    receiveGameEvent: mockReceiveGameEvent,
    triggerTestTask: mockTriggerTestTask,
    destroy: mockDestroyGame,
  })),
}))

let mockSnapshotEvents: GameEvent[] = []

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: jest.fn(() => ({
    agents: [],
    events: [],
    stats: { totalEvents: 0, activeTasks: 0 },
    taskHistory: [],
  })),
}))

jest.mock('@/hooks/useSnapshotStream', () => ({
  useSnapshotStream: jest.fn(() => ({
    agents: [],
    sessions: [],
    tasks: mockSnapshotEvents.length > 0 ? [{
      taskId: 'task-001',
      description: 'Snapshot task',
      currentPhase: 'developer',
      currentAgentId: 'dev-agent',
      currentAgentName: 'Dev',
      createdAt: 1,
      updatedAt: 2,
      status: 'in_progress',
      phases: [],
      recentEvents: mockSnapshotEvents,
    }] : [],
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


// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dashboard page: snapshot event → Phaser EventBus bridge', () => {
  beforeEach(() => {
    mockReceiveGameEvent.mockClear()
    mockTriggerTestTask.mockClear()
    mockDestroyGame.mockClear()
    mockSnapshotEvents = []
  })

  async function renderAndWaitForGame() {
    const result = render(React.createElement(DashboardPage))
    // Wait for async game import and bridge useEffect to run
    await act(async () => {
      await new Promise(r => setTimeout(r, 50))
    })
    return result
  }

  // ── #1 pm:analysis-complete → receiveGameEvent ────────────────────────────

  it('snapshot 包含 pm:analysis-complete 后应调用 game.receiveGameEvent()', async () => {
    const event: GameEvent = {
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
      payload: { projectId: 'test', taskCount: 2, analysis: '需求分析' },
    }
    mockSnapshotEvents = [event]

    await renderAndWaitForGame()

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'pm:analysis-complete' }),
      )
    })
  })

  // ── #2 dev:iteration-start → receiveGameEvent ─────────────────────────────

  it('snapshot 包含 dev:iteration-start 后应调用 game.receiveGameEvent()', async () => {
    const event: GameEvent = {
      type: 'dev:iteration-start',
      agentId: 'dev-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, hasFeedback: false },
    }
    mockSnapshotEvents = [event]

    await renderAndWaitForGame()

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dev:iteration-start' }),
      )
    })
  })

  // ── #3 workflow:iteration-complete → receiveGameEvent ────────────────────

  it('snapshot 包含 workflow:iteration-complete 后应调用 game.receiveGameEvent()', async () => {
    const event: GameEvent = {
      type: 'workflow:iteration-complete',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', totalIterations: 1, approved: true },
    }
    mockSnapshotEvents = [event]

    await renderAndWaitForGame()

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow:iteration-complete',
          payload: expect.objectContaining({ approved: true }),
        }),
      )
    })
  })

  // ── #4 review:rejected → receiveGameEvent ────────────────────────────────

  it('snapshot 包含 review:rejected 后应调用 game.receiveGameEvent()', async () => {
    const event: GameEvent = {
      type: 'review:rejected',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, feedback: '错误处理不足' },
    }
    mockSnapshotEvents = [event]

    await renderAndWaitForGame()

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'review:rejected' }),
      )
    })
  })

  // ── #5 agent:status-change 也应转发 ──────────────────────────────────────

  it('snapshot 包含 agent:status-change 后应调用 game.receiveGameEvent()', async () => {
    const event: GameEvent = {
      type: 'agent:status-change',
      agentId: 'dev-agent',
      status: 'busy',
      timestamp: Date.now(),
    }
    mockSnapshotEvents = [event]

    await renderAndWaitForGame()

    await waitFor(() => {
      expect(mockReceiveGameEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'agent:status-change', agentId: 'dev-agent' }),
      )
    })
  })

  // ── #6 game 未初始化时不应崩溃 ───────────────────────────────────────────

  it('game 尚未初始化时推送事件不应抛出错误', async () => {
    // Don't wait for game to init; snapshot event should be buffered without throwing.
    mockSnapshotEvents = [{
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
      payload: { projectId: 'test', taskCount: 1, analysis: '测试' },
    }]
    render(React.createElement(DashboardPage))

    // Should not throw
    await expect(
      act(async () => { await Promise.resolve() })
    ).resolves.not.toThrow()
  })
})
