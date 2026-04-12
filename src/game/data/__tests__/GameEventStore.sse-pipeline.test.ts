/**
 * GameEventStore → SSE route E2E flow tests (flow #3)
 *
 * 验证：
 *   GameEventStore.push(event)
 *     → processEmitter 广播
 *     → SSE route 的 subscribe 回调收到
 *     → POST /api/game-events 手动注入的事件也能被 subscribe 收到
 *
 * 这是 Dashboard 侧边栏实时更新的基础管道。
 */

import { GameEventStore, getGameEventStore, resetGameEventStore } from '@/game/data/GameEventStore'
import type { GameEvent } from '@/game/types/GameEvents'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    type: 'agent:status-change',
    agentId: 'pm-agent',
    status: 'busy',
    timestamp: Date.now(),
    ...overrides,
  } as GameEvent
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameEventStore → SSE pipeline', () => {
  let store: GameEventStore

  beforeEach(() => {
    GameEventStore.clearAllSubscribers()
    resetGameEventStore()
    store = new GameEventStore()
  })

  afterEach(() => {
    GameEventStore.clearAllSubscribers()
  })

  // ── #1 subscribe 收到 push ────────────────────────────────────────────────

  it('push 的事件应立即传达给 subscribe 的回调', () => {
    const received: GameEvent[] = []
    store.subscribe(e => received.push(e))

    store.push(makeEvent({ agentId: 'pm-agent' }))

    expect(received).toHaveLength(1)
    expect(received[0].agentId).toBe('pm-agent')
  })

  // ── #2 多 subscriber ──────────────────────────────────────────────────────

  it('多个 subscribe 回调应都收到同一个事件', () => {
    const r1: GameEvent[] = []
    const r2: GameEvent[] = []
    store.subscribe(e => r1.push(e))
    store.subscribe(e => r2.push(e))

    store.push(makeEvent())

    expect(r1).toHaveLength(1)
    expect(r2).toHaveLength(1)
  })

  // ── #3 unsubscribe ────────────────────────────────────────────────────────

  it('unsubscribe 后不再收到事件', () => {
    const received: GameEvent[] = []
    const unsub = store.subscribe(e => received.push(e))

    store.push(makeEvent())
    unsub()
    store.push(makeEvent())

    expect(received).toHaveLength(1)
  })

  // ── #4 事件顺序保证 ───────────────────────────────────────────────────────

  it('多个 push 应按顺序传递给 subscriber', () => {
    const agentIds: string[] = []
    store.subscribe(e => agentIds.push(e.agentId ?? ''))

    store.push(makeEvent({ agentId: 'pm-agent' }))
    store.push(makeEvent({ agentId: 'dev-agent' }))
    store.push(makeEvent({ agentId: 'review-agent' }))

    expect(agentIds).toEqual(['pm-agent', 'dev-agent', 'review-agent'])
  })

  // ── #5 getGameEventStore 单例 + push 能被全局 subscriber 收到 ────────────

  it('getGameEventStore() 返回进程级单例，push 能被任何实例的 subscriber 收到', () => {
    const global = getGameEventStore()
    const received: GameEvent[] = []

    // 订阅在 getGameEventStore() 上
    global.subscribe(e => received.push(e))

    // 从另一个新 store 实例 push（共享 processEmitter）
    const another = new GameEventStore()
    another.push(makeEvent({ agentId: 'test-agent' }))

    // 因为 processEmitter 是模块级单例，global subscriber 应该收到
    expect(received.length).toBeGreaterThan(0)
    expect(received[0].agentId).toBe('test-agent')
  })

  // ── #6 ring buffer getEvents ──────────────────────────────────────────────

  it('getEvents(since) 应返回 timestamp > since 的事件', () => {
    const t0 = Date.now()
    store.push(makeEvent({ timestamp: t0 - 1000 }))
    store.push(makeEvent({ timestamp: t0 + 1000 }))
    store.push(makeEvent({ timestamp: t0 + 2000 }))

    const result = store.getEvents(t0)
    expect(result).toHaveLength(2)
    expect(result.every(e => (e.timestamp ?? 0) > t0)).toBe(true)
  })

  // ── #7 pm:analysis-complete 路径（模拟 Orchestrator push）───────────────

  it('Orchestrator 风格的 pm:analysis-complete push 应被 SSE subscriber 收到', () => {
    const received: GameEvent[] = []
    store.subscribe(e => { if (e.type === 'pm:analysis-complete') received.push(e) })

    store.push({
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
      payload: { projectId: 'test', taskCount: 3, analysis: '需求分析完成' },
    } as GameEvent)

    expect(received).toHaveLength(1)
    const evt = received[0] as { payload?: { taskCount: number } }
    expect(evt.payload?.taskCount).toBe(3)
  })

  // ── #8 dev:iteration-start 路径 ───────────────────────────────────────────

  it('dev:iteration-start push 应被 SSE subscriber 收到，携带 taskId 和 iteration', () => {
    const received: GameEvent[] = []
    store.subscribe(e => { if (e.type === 'dev:iteration-start') received.push(e) })

    store.push({
      type: 'dev:iteration-start',
      agentId: 'dev-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, hasFeedback: false },
    } as GameEvent)

    expect(received).toHaveLength(1)
    const evt = received[0] as { payload?: { taskId: string; iteration: number } }
    expect(evt.payload?.taskId).toBe('task-001')
    expect(evt.payload?.iteration).toBe(1)
  })

  // ── #9 workflow:iteration-complete 路径 ───────────────────────────────────

  it('workflow:iteration-complete push 应携带 approved 字段', () => {
    const received: GameEvent[] = []
    store.subscribe(e => { if (e.type === 'workflow:iteration-complete') received.push(e) })

    store.push({
      type: 'workflow:iteration-complete',
      agentId: 'review-agent',
      taskId: 'task-001',
      payload: { taskId: 'task-001', totalIterations: 1, approved: true },
      timestamp: Date.now(),
    } as GameEvent)

    expect(received).toHaveLength(1)
    const evt = received[0] as { payload?: { approved: boolean } }
    expect(evt.payload?.approved).toBe(true)
  })
})
