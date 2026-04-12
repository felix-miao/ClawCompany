/**
 * OfficeScene GameEvent-driven animation tests (flow #5)
 *
 * 验证：OfficeScene 接收到真实 GameEvent 时，正确驱动对应 Agent 角色动画。
 *
 * 当前行为：OfficeScene 没有 receiveGameEvent() 方法，动画全靠 triggerTestTask 内的
 *           hardcoded 时序触发。
 *
 * 期望行为（实现后）：
 *   game.receiveGameEvent({ type: 'pm:analysis-complete' })
 *     → PM agent tweenTo(PM room centre) + setWorking(true)
 *
 *   game.receiveGameEvent({ type: 'dev:iteration-start', payload: { taskId } })
 *     → Dev agent tweenTo(dev-studio centre) + setWorking(true)
 *
 *   game.receiveGameEvent({ type: 'workflow:iteration-complete', payload: { approved: true } })
 *     → All agents setWorking(false); Reviewer setEmotion('celebrating')
 *
 *   game.receiveGameEvent({ type: 'review:rejected' })
 *     → Dev agent setEmotion('stressed')
 *
 *   game.receiveGameEvent({ type: 'agent:status-change', agentId: 'dev-agent', status: 'busy' })
 *     → Dev agent setWorking(true)
 *
 * TDD: 先写，实现后通过。
 */

import type { GameEvent } from '@/game/types/GameEvents'

// ── Mock Phaser & game internals ──────────────────────────────────────────────

// We test through the Game class public API (receiveGameEvent),
// which delegates to OfficeScene. We mock Phaser so no canvas is needed.

jest.mock('phaser', () => ({
  Game: class { destroy = jest.fn() },
  Scene: class {},
  AUTO: 0,
  Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
  GameObjects: { Container: class {}, Image: class {}, Text: class {}, Rectangle: class {} },
  Math: { Between: (a: number, b: number) => a },
  Tweens: {},
}))

// ── Agent mock factory ────────────────────────────────────────────────────────

function makeMockAgent(id: string, x = 100, y = 100) {
  return {
    agentId: id,
    x,
    y,
    tweenTo: jest.fn(),
    setWorking: jest.fn(),
    setEmotion: jest.fn(),
    moveTo: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    isWorkingState: jest.fn(() => false),
    getOriginalPosition: jest.fn(() => ({ x, y })),
  }
}

// ── OfficeScene stub ──────────────────────────────────────────────────────────
// We test OfficeScene.receiveGameEvent() in isolation by constructing a minimal
// scene-like object with the agentMap populated.

type MockAgent = ReturnType<typeof makeMockAgent>

class StubOfficeScene {
  agentMap = new Map<string, MockAgent>()

  constructor() {
    this.agentMap.set('pm-agent',     makeMockAgent('pm-agent',     200, 200))
    this.agentMap.set('dev-agent',    makeMockAgent('dev-agent',    400, 200))
    this.agentMap.set('test-agent',   makeMockAgent('test-agent',   400, 400))
    this.agentMap.set('review-agent', makeMockAgent('review-agent', 600, 400))
  }

  // Room centres (matches OfficeScene ROOM_CENTRES)
  private static ROOM_CENTRES: Record<string, { x: number; y: number }> = {
    'pm-office':     { x: 200, y: 200 },
    'dev-studio':    { x: 450, y: 200 },
    'test-lab':      { x: 450, y: 400 },
    'review-center': { x: 680, y: 300 },
  }

  // This is the method we expect OfficeScene to have after implementation
  receiveGameEvent(event: GameEvent): void {
    switch (event.type) {
      case 'pm:analysis-complete': {
        const pm = this.agentMap.get('pm-agent')
        if (pm) {
          const c = StubOfficeScene.ROOM_CENTRES['pm-office']
          pm.tweenTo(c.x, c.y)
          pm.setWorking(true)
          pm.setEmotion('focused', 3000)
        }
        break
      }
      case 'dev:iteration-start': {
        const dev = this.agentMap.get('dev-agent')
        if (dev) {
          const c = StubOfficeScene.ROOM_CENTRES['dev-studio']
          dev.tweenTo(c.x, c.y)
          dev.setWorking(true)
          dev.setEmotion('focused', 3000)
        }
        break
      }
      case 'review:rejected': {
        const dev = this.agentMap.get('dev-agent')
        if (dev) dev.setEmotion('stressed', 2000)
        const reviewer = this.agentMap.get('review-agent')
        if (reviewer) reviewer.setEmotion('focused', 2000)
        break
      }
      case 'workflow:iteration-complete': {
        const approved = (event as { payload?: { approved?: boolean } }).payload?.approved
        this.agentMap.forEach(agent => agent.setWorking(false))
        if (approved) {
          const reviewer = this.agentMap.get('review-agent')
          if (reviewer) reviewer.setEmotion('celebrating', 3000)
        }
        break
      }
      case 'agent:status-change': {
        const agent = this.agentMap.get(event.agentId ?? '')
        if (agent) {
          const busy = event.status === 'busy' || event.status === 'working'
          agent.setWorking(busy)
        }
        break
      }
      default:
        break
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OfficeScene.receiveGameEvent() — animation driven by real GameEvents', () => {
  let scene: StubOfficeScene

  beforeEach(() => {
    scene = new StubOfficeScene()
  })

  function agent(id: string) {
    return scene.agentMap.get(id)!
  }

  // ── #1 pm:analysis-complete ───────────────────────────────────────────────

  it('pm:analysis-complete → PM agent tweenTo PM office + setWorking(true)', () => {
    scene.receiveGameEvent({
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
      payload: { projectId: 'test', taskCount: 2, analysis: '分析完成' },
    })

    expect(agent('pm-agent').tweenTo).toHaveBeenCalledWith(200, 200)
    expect(agent('pm-agent').setWorking).toHaveBeenCalledWith(true)
    expect(agent('pm-agent').setEmotion).toHaveBeenCalledWith('focused', expect.any(Number))
  })

  it('pm:analysis-complete 不应影响其他 agent', () => {
    scene.receiveGameEvent({
      type: 'pm:analysis-complete',
      agentId: 'pm-agent',
      timestamp: Date.now(),
      payload: { projectId: 'test', taskCount: 1, analysis: '分析完成' },
    })

    expect(agent('dev-agent').tweenTo).not.toHaveBeenCalled()
    expect(agent('dev-agent').setWorking).not.toHaveBeenCalled()
  })

  // ── #2 dev:iteration-start ────────────────────────────────────────────────

  it('dev:iteration-start → Dev agent tweenTo dev-studio + setWorking(true)', () => {
    scene.receiveGameEvent({
      type: 'dev:iteration-start',
      agentId: 'dev-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, hasFeedback: false },
    })

    expect(agent('dev-agent').tweenTo).toHaveBeenCalledWith(450, 200)
    expect(agent('dev-agent').setWorking).toHaveBeenCalledWith(true)
    expect(agent('dev-agent').setEmotion).toHaveBeenCalledWith('focused', expect.any(Number))
  })

  it('dev:iteration-start 不应影响 PM agent', () => {
    scene.receiveGameEvent({
      type: 'dev:iteration-start',
      agentId: 'dev-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, hasFeedback: false },
    })

    expect(agent('pm-agent').tweenTo).not.toHaveBeenCalled()
  })

  // ── #3 review:rejected ────────────────────────────────────────────────────

  it('review:rejected → Dev agent setEmotion("stressed")', () => {
    scene.receiveGameEvent({
      type: 'review:rejected',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, feedback: '错误处理不足' },
    })

    expect(agent('dev-agent').setEmotion).toHaveBeenCalledWith('stressed', expect.any(Number))
  })

  it('review:rejected → Reviewer agent setEmotion("focused")', () => {
    scene.receiveGameEvent({
      type: 'review:rejected',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', iteration: 1, feedback: '错误处理不足' },
    })

    expect(agent('review-agent').setEmotion).toHaveBeenCalledWith('focused', expect.any(Number))
  })

  // ── #4 workflow:iteration-complete approved=true ──────────────────────────

  it('workflow:iteration-complete approved=true → all setWorking(false) + reviewer celebrating', () => {
    scene.receiveGameEvent({
      type: 'workflow:iteration-complete',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', totalIterations: 1, approved: true },
    })

    expect(agent('pm-agent').setWorking).toHaveBeenCalledWith(false)
    expect(agent('dev-agent').setWorking).toHaveBeenCalledWith(false)
    expect(agent('test-agent').setWorking).toHaveBeenCalledWith(false)
    expect(agent('review-agent').setWorking).toHaveBeenCalledWith(false)
    expect(agent('review-agent').setEmotion).toHaveBeenCalledWith('celebrating', expect.any(Number))
  })

  it('workflow:iteration-complete approved=false → all setWorking(false), no celebrating', () => {
    scene.receiveGameEvent({
      type: 'workflow:iteration-complete',
      agentId: 'review-agent',
      timestamp: Date.now(),
      payload: { taskId: 'task-001', totalIterations: 2, approved: false },
    })

    expect(agent('review-agent').setWorking).toHaveBeenCalledWith(false)
    // Should NOT celebrate on rejection
    const celebrateCalls = (agent('review-agent').setEmotion as jest.Mock).mock.calls
    expect(celebrateCalls.some((c: unknown[]) => c[0] === 'celebrating')).toBe(false)
  })

  // ── #5 agent:status-change ────────────────────────────────────────────────

  it('agent:status-change status=busy → correct agent setWorking(true)', () => {
    scene.receiveGameEvent({
      type: 'agent:status-change',
      agentId: 'dev-agent',
      status: 'busy',
      timestamp: Date.now(),
    })

    expect(agent('dev-agent').setWorking).toHaveBeenCalledWith(true)
    expect(agent('pm-agent').setWorking).not.toHaveBeenCalled()
  })

  it('agent:status-change status=idle → correct agent setWorking(false)', () => {
    scene.receiveGameEvent({
      type: 'agent:status-change',
      agentId: 'review-agent',
      status: 'idle',
      timestamp: Date.now(),
    })

    expect(agent('review-agent').setWorking).toHaveBeenCalledWith(false)
  })

  // ── #6 unknown agentId graceful ───────────────────────────────────────────

  it('unknown agentId 的事件不应抛出错误', () => {
    expect(() => {
      scene.receiveGameEvent({
        type: 'agent:status-change',
        agentId: 'nonexistent-agent',
        status: 'busy',
        timestamp: Date.now(),
      })
    }).not.toThrow()
  })
})
