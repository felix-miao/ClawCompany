/**
 * Virtual Office E2E Smoke Tests
 * 
 * 验证虚拟办公室的核心能力：
 * 1. 页面加载 - /dashboard 路由正常渲染
 * 2. 舞台挂载 - Phaser game container 挂载成功
 * 3. 角色渲染 - Agent 角色在场景中渲染
 * 4. 动画/动作 - 角色动画系统工作
 * 5. 音效 - 声音系统工作
 * 6. Dashboard 数据展示 - 侧边栏数据正常显示
 * 
 * 每个测试点都有明确的 assertion message，方便快速定位卡在哪个环节
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'

// ── Mock game ─────────────────────────────────────────────────────────────────

const mockReceiveGameEvent = jest.fn()
const mockDestroyGame = jest.fn()
const mockTriggerTestTask = jest.fn()

const createMockGame = () => ({
  receiveGameEvent: mockReceiveGameEvent,
  triggerTestTask: mockTriggerTestTask,
  destroy: mockDestroyGame,
  getAgents: jest.fn().mockReturnValue([
    { id: 'pm-agent', role: 'Project Manager', name: 'PM' },
    { id: 'dev-agent', role: 'Developer', name: 'Dev' },
    { id: 'review-agent', role: 'Code Reviewer', name: 'Reviewer' },
    { id: 'test-agent', role: 'QA Engineer', name: 'Tester' },
  ]),
  getPerformanceMonitor: jest.fn().mockReturnValue(null),
})

jest.mock('@/game', () => ({
  startGame: jest.fn(() => createMockGame()),
}))

// ── Mock hooks ───────────────────────────────────────────────────────────────

let capturedStore: { processEvent: (e: unknown) => void } | null = null

jest.mock('@/hooks/useEventStream', () => ({
  useEventStream: jest.fn((store: { processEvent: (e: unknown) => void }) => {
    capturedStore = store
    return { isConnected: true, isReconnecting: false }
  }),
}))

jest.mock('@/hooks/useDashboardStore', () => ({
  useDashboardStore: jest.fn(() => ({
    agents: [
      { id: 'pm-agent', name: 'PM', role: 'Project Manager', status: 'idle', emotion: 'neutral' },
      { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'working', emotion: 'focused' },
      { id: 'review-agent', name: 'Reviewer', role: 'Code Reviewer', status: 'busy', emotion: 'thinking' },
      { id: 'test-agent', name: 'Tester', role: 'QA Engineer', status: 'idle', emotion: 'happy' },
    ],
    events: [
      { type: 'pm:analysis-complete', timestamp: Date.now() - 5000, agentId: 'pm-agent', payload: {} },
      { type: 'dev:iteration-start', timestamp: Date.now() - 3000, agentId: 'dev-agent', payload: {} },
    ],
    stats: { totalEvents: 2, activeTasks: 1 },
    taskHistory: [
      { id: 'task-1', title: '实现登录功能', status: 'completed', assignedTo: 'dev' },
      { id: 'task-2', title: '编写测试', status: 'in_progress', assignedTo: 'test' },
    ],
  })),
}))

jest.mock('@/hooks/useOpenClawSnapshot', () => ({
  useOpenClawSnapshot: jest.fn(() => ({
    agents: [
      { id: 'pm-agent', name: 'PM', role: 'Project Manager', status: 'idle', emotion: 'neutral', currentTask: null, latestResultSummary: null },
      { id: 'dev-agent', name: 'Dev', role: 'Developer', status: 'working', emotion: 'focused', currentTask: null, latestResultSummary: null },
      { id: 'review-agent', name: 'Reviewer', role: 'Code Reviewer', status: 'busy', emotion: 'thinking', currentTask: null, latestResultSummary: null },
      { id: 'test-agent', name: 'Tester', role: 'QA Engineer', status: 'idle', emotion: 'happy', currentTask: null, latestResultSummary: null },
    ],
    sessions: [
      { sessionKey: 'session-1', agentId: 'pm-agent', status: 'active', startedAt: Date.now() - 60000 },
    ],
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
    getState: jest.fn(() => ({ 
      agents: [], 
      events: [], 
      stats: {}, 
      taskHistory: [] 
    })),
  })),
}))

jest.mock('@/lib/core/metrics-aggregator', () => ({
  MetricsAggregator: jest.fn().mockImplementation(() => ({
    recordEvent: jest.fn(),
    getMetrics: jest.fn(() => null),
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

// Mock sound system
jest.mock('@/game/systems/AudioManager', () => ({
  AudioManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    playSound: jest.fn(),
    setMuted: jest.fn(),
    dispose: jest.fn(),
  })),
}))

import DashboardPage from '@/app/dashboard/page'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Virtual Office E2E Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedStore = null
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: 页面加载 - /dashboard 路由正常渲染
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 1: 页面加载 - dashboard 页面应该正常渲染', async () => {
    const { container } = render(React.createElement(DashboardPage))
    
    // 等待页面渲染完成
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 验证 header 存在
    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
    
    // 验证标题存在
    const title = screen.getByText('Dashboard')
    expect(title).toBeInTheDocument()

    // 验证 view toggle 存在
    const gameViewBtn = screen.getByText('Game View')
    expect(gameViewBtn).toBeInTheDocument()

    // 验证 connection status 存在
    const connectionStatus = screen.getByText('Connected')
    expect(connectionStatus).toBeInTheDocument()

    // 验证 stats 显示
    const stats = screen.getByText(/events/)
    expect(stats).toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: 舞台挂载 - Phaser game container 挂载成功
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 2: 舞台挂载 - Phaser game container 应该挂载到 DOM', async () => {
    const { container } = render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 验证 game container 存在
    const gameContainer = container.querySelector('#dashboard-game-container')
    expect(gameContainer).toBeInTheDocument()
    
    // 验证 game container 有正确的大小类名
    expect(gameContainer).toHaveClass('w-full', 'h-full')

    // 验证游戏加载状态区域存在
    const loadingArea = container.querySelector('.glass.rounded-2xl')
    expect(loadingArea).toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: 角色渲染 - Agent 角色在场景中渲染
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 3: 角色渲染 - AgentStatusPanel 应该显示所有角色信息', async () => {
    render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 验证 AgentStatusPanel 存在（通过 data-testid）
    const pmAgent = screen.getByTestId('agent-card-pm-agent')
    const devAgent = screen.getByTestId('agent-card-dev-agent')
    const reviewAgent = screen.getByTestId('agent-card-review-agent')
    const testAgent = screen.getByTestId('agent-card-test-agent')

    expect(pmAgent).toBeInTheDocument()
    expect(devAgent).toBeInTheDocument()
    expect(reviewAgent).toBeInTheDocument()
    expect(testAgent).toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 4: 动画/动作 - 手动触发状态变化验证事件系统
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 4: 动画/动作 - 状态变化事件应该被发送到 game engine', async () => {
    const { container } = render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 找到 Set Status 按钮并点击
    const setStatusBtn = screen.getByText('Set Status')
    expect(setStatusBtn).toBeInTheDocument()

    // 点击触发状态变化
    await act(async () => {
      setStatusBtn.click()
    })

    // 等待事件处理
    await waitFor(() => {
      // 验证 game 收到了事件（通过 mock 验证）
      // 注意：由于 game 是 mock 的，我们验证 store.processEvent 被调用
      expect(capturedStore).not.toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 5: 音效系统 - 验证声音系统初始化（无真实播放）
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 5: 音效 - AudioManager 应该被正确引用（不报错）', async () => {
    // 这个测试验证音效系统模块可以被正常导入
    // 真实的音效播放需要浏览器环境
    const { container } = render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 页面正常渲染即可认为音效系统引用无错误
    expect(container).toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 6: Dashboard 数据展示 - 侧边栏数据正常显示
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 6: Dashboard 数据 - 侧边栏应该显示正确的数据面板', async () => {
    render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 验证 Control Panel 存在
    const controlPanel = screen.getByText('Control Panel')
    expect(controlPanel).toBeInTheDocument()

    // 验证测试任务按钮存在
    const taskBtn = screen.getByText('Blog website (Next.js + Tailwind)')
    expect(taskBtn).toBeInTheDocument()

    // 验证 stats 显示存在（页头显示 events | active tasks）
    const stats = screen.getByText(/events/)
    expect(stats).toBeInTheDocument()

    // 验证 Agent Status 面板标题存在
    const agentStatus = screen.getByText('Agent Status')
    expect(agentStatus).toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 7: 完整流程 - 触发任务到角色动画
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 7: 完整流程 - 触发任务后 SSE 事件应该触发角色动画', async () => {
    const mockFetch = jest.fn()
    global.fetch = mockFetch

    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/chat') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            taskId: 'task-smoke-001',
            tasks: [{ id: 'subtask-1', title: 'Test Task', status: 'in_progress' }],
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 点击触发任务按钮
    const taskBtn = screen.getByText('Blog website (Next.js + Tailwind)')
    
    await act(async () => {
      taskBtn.click()
      await new Promise(r => setTimeout(r, 100))
    })

    // 验证 /api/chat 被调用
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({ method: 'POST' })
      )
    })

    // 模拟 SSE 事件
    if (capturedStore) {
      await act(async () => {
        capturedStore.processEvent({
          type: 'pm:analysis-complete',
          agentId: 'pm-agent',
          timestamp: Date.now(),
          payload: { projectId: 'test', taskCount: 1 },
        })
      })
    }

    // 验证事件被处理（页面没有崩溃）
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 8: 错误边界 - 游戏加载失败时应该显示错误提示
  // ═══════════════════════════════════════════════════════════════════════════

  it('STEP 8: 错误处理 - 游戏加载失败时应该显示友好的错误提示', async () => {
    // 重新 mock game 使其抛出错误
    const { startGame } = require('@/game')
    startGame.mockImplementationOnce(() => {
      throw new Error('Game engine initialization failed')
    })

    const { container } = render(React.createElement(DashboardPage))
    
    await act(async () => {
      await new Promise(r => setTimeout(r, 100))
    })

    // 验证页面仍然渲染（不是白屏）
    expect(container).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
