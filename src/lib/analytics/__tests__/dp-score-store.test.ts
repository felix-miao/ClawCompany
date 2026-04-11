/**
 * DPScoreStore 单元测试
 * 使用内存数据库（:memory:）隔离测试环境
 */

import { DPScoreStore, buildDPScoreRecord, DPScoreRecord } from '../dp-score-store'

// 使用内存 DB 实例，不影响实际文件
function createStore(): DPScoreStore {
  return new DPScoreStore(':memory:')
}

describe('DPScoreStore', () => {
  let store: DPScoreStore

  beforeEach(() => {
    store = createStore()
    DPScoreStore.resetInstance()
  })

  afterEach(() => {
    store.close()
    DPScoreStore.resetInstance()
  })

  describe('save & getRecent', () => {
    it('saves a record and retrieves it', () => {
      const record = buildDPScoreRecord('task-1', 'dev', 80, 1.0)
      const saved = store.save(record)

      expect(saved.id).toBeDefined()
      expect(saved.task_id).toBe('task-1')
      expect(saved.critic_score).toBe(80)
      expect(saved.dp_score).toBe(80)

      const recent = store.getRecent(10)
      expect(recent).toHaveLength(1)
      expect(recent[0].task_id).toBe('task-1')
    })

    it('applies independence penalty correctly', () => {
      const record = buildDPScoreRecord('task-2', 'dev', 80, 0.5)
      store.save(record)

      const recent = store.getRecent(1)
      expect(recent[0].dp_score).toBe(40)
      expect(recent[0].independence_penalty).toBe(0.5)
    })

    it('clamps dp_score between 0 and 100', () => {
      const r = buildDPScoreRecord('t', 'dev', 150, 2.0)
      expect(r.dp_score).toBe(100)

      const r2 = buildDPScoreRecord('t', 'dev', 80, 0)
      expect(r2.dp_score).toBe(0)
    })

    it('returns recent N records ordered by timestamp desc', () => {
      for (let i = 1; i <= 15; i++) {
        store.save(buildDPScoreRecord(`task-${i}`, 'dev', i * 5, 1.0))
      }

      const recent = store.getRecent(10)
      expect(recent).toHaveLength(10)
      // Most recent should have highest task number (we inserted sequentially)
      expect(recent[0].task_id).toBe('task-15')
    })
  })

  describe('getRecentAverage', () => {
    it('returns 0 when no records', () => {
      expect(store.getRecentAverage(10)).toBe(0)
    })

    it('calculates average of recent N records', () => {
      store.save(buildDPScoreRecord('t1', 'dev', 60, 1.0))
      store.save(buildDPScoreRecord('t2', 'dev', 80, 1.0))
      store.save(buildDPScoreRecord('t3', 'dev', 100, 1.0))

      // All 3 → average = (60 + 80 + 100) / 3 = 80
      expect(store.getRecentAverage(3)).toBe(80)
      // Last 2 → average = (80 + 100) / 2 = 90
      expect(store.getRecentAverage(2)).toBe(90)
    })
  })

  describe('getByTaskType', () => {
    it('groups by task type and calculates average', () => {
      store.save(buildDPScoreRecord('t1', 'dev', 60, 1.0))
      store.save(buildDPScoreRecord('t2', 'dev', 80, 1.0))
      store.save(buildDPScoreRecord('t3', 'review', 90, 1.0))

      const byType = store.getByTaskType()
      expect(byType['dev']).toEqual({ average: 70, count: 2 })
      expect(byType['review']).toEqual({ average: 90, count: 1 })
    })

    it('returns empty object when no records', () => {
      expect(store.getByTaskType()).toEqual({})
    })
  })

  describe('getLast24hHourly', () => {
    it('returns empty array when no records', () => {
      expect(store.getLast24hHourly()).toEqual([])
    })

    it('only returns records within last 24h', () => {
      // Old record (25h ago)
      const old: Omit<DPScoreRecord, 'id'> = {
        task_id: 'old',
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        proposer_score: 100,
        critic_score: 80,
        dp_score: 80,
        task_type: 'dev',
        independence_penalty: 1.0,
      }
      store.save(old)

      // Recent record (1h ago)
      store.save({
        ...old,
        task_id: 'recent',
        timestamp: Date.now() - 60 * 60 * 1000,
      })

      const hourly = store.getLast24hHourly()
      expect(hourly).toHaveLength(1)
    })
  })

  describe('getTrend', () => {
    it('returns a complete trend report', () => {
      store.save(buildDPScoreRecord('t1', 'dev', 75, 0.9))
      store.save(buildDPScoreRecord('t2', 'review', 85, 1.0))

      const trend = store.getTrend()
      expect(trend.totalCount).toBe(2)
      expect(trend.recentRecords).toHaveLength(2)
      expect(trend.recentAverage).toBeGreaterThan(0)
      expect(typeof trend.byTaskType).toBe('object')
      expect(Array.isArray(trend.last24hHourly)).toBe(true)
    })
  })
})

describe('buildDPScoreRecord', () => {
  it('builds a record with correct dp_score', () => {
    const r = buildDPScoreRecord('tid', 'dev', 80, 0.75, 90)
    expect(r.task_id).toBe('tid')
    expect(r.task_type).toBe('dev')
    expect(r.critic_score).toBe(80)
    expect(r.proposer_score).toBe(90)
    expect(r.independence_penalty).toBe(0.75)
    expect(r.dp_score).toBe(60) // 80 * 0.75
  })

  it('defaults to proposerScore=100 and penalty=1.0', () => {
    const r = buildDPScoreRecord('t', 'dev', 70)
    expect(r.proposer_score).toBe(100)
    expect(r.independence_penalty).toBe(1)
    expect(r.dp_score).toBe(70)
  })

  it('has a recent timestamp', () => {
    const before = Date.now()
    const r = buildDPScoreRecord('t', 'dev', 80)
    const after = Date.now()
    expect(r.timestamp).toBeGreaterThanOrEqual(before)
    expect(r.timestamp).toBeLessThanOrEqual(after)
  })
})
