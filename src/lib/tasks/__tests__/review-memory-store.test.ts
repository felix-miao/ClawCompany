/**
 * ReviewMemoryStore unit tests
 */
import { ReviewMemoryStore, buildReviewHistoryContext, ReviewIssue } from '../review-memory-store'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

describe('ReviewMemoryStore', () => {
  let store: ReviewMemoryStore
  const testDbPath = path.join(os.tmpdir(), `test-review-memory-${Date.now()}.db`)

  beforeEach(() => {
    ReviewMemoryStore.resetInstance()
    store = new ReviewMemoryStore(testDbPath)
  })

  afterEach(() => {
    store.close()
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
  })

  describe('indexIssue', () => {
    it('should index a single issue and return a row ID', () => {
      const issue: ReviewIssue = {
        task_id: 'task-1',
        file_path: 'src/foo.ts',
        issue_type: 'security',
        description: 'eval() usage detected — potential code injection risk',
        severity: 'critical',
        resolved: false,
      }
      const id = store.indexIssue(issue)
      expect(id).toBeGreaterThan(0)
      expect(store.getTotalCount()).toBe(1)
    })
  })

  describe('index (batch from review response)', () => {
    it('should extract issues from metadata.checks', () => {
      store.index('task-2', {
        message: 'Review complete',
        metadata: {
          checks: [
            { name: 'TypeScript 类型安全', passed: false, warning: true, message: '使用了 any 类型' },
            { name: '错误处理', passed: false, message: '缺少 try-catch' },
            { name: '代码风格', passed: true },
          ],
          suggestions: ['建议添加单元测试'],
          score: 65,
        },
      }, ['src/bar.ts'])

      // 2 failing checks + 1 suggestion = 3 issues
      expect(store.getTotalCount()).toBe(3)
    })

    it('should extract issues from plain text message', () => {
      store.index('task-3', {
        message: '❌ 发现安全漏洞：用户输入未验证\n⚠️ 性能问题：循环中使用了 await\n✅ 代码风格良好',
      })
      // 2 issues (❌ and ⚠️; ✅ is passing so skipped)
      expect(store.getTotalCount()).toBe(2)
    })
  })

  describe('search', () => {
    beforeEach(() => {
      store.indexIssue({
        task_id: 'task-a',
        file_path: 'src/auth.ts',
        issue_type: 'security',
        description: 'SQL injection vulnerability in query builder',
        severity: 'critical',
        resolved: false,
      })
      store.indexIssue({
        task_id: 'task-b',
        file_path: 'src/utils.ts',
        issue_type: 'performance',
        description: 'await inside for loop causes sequential execution',
        severity: 'warning',
        resolved: false,
      })
      store.indexIssue({
        task_id: 'task-c',
        file_path: 'src/auth.ts',
        issue_type: 'type-safety',
        description: 'using any type bypasses TypeScript checks',
        severity: 'warning',
        resolved: true,
      })
    })

    it('should find relevant results by keyword', () => {
      const results = store.search('security injection', 10)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].issue_type).toBe('security')
    })

    it('should respect topK limit', () => {
      const results = store.search('auth', 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should return empty array for empty query', () => {
      expect(store.search('', 10)).toEqual([])
    })

    it('should handle FTS5 special chars without throwing', () => {
      expect(() => store.search('a OR (b AND c)', 5)).not.toThrow()
    })
  })

  describe('getPatterns', () => {
    beforeEach(() => {
      // Index same issue type 3 times for src/auth.ts
      for (let i = 0; i < 3; i++) {
        store.indexIssue({
          task_id: `task-${i}`,
          file_path: 'src/auth.ts',
          issue_type: 'security',
          description: `Security issue ${i}`,
          severity: 'critical',
          resolved: false,
        })
      }
      store.indexIssue({
        task_id: 'task-x',
        file_path: 'src/other.ts',
        issue_type: 'performance',
        description: 'Performance issue',
        severity: 'warning',
        resolved: false,
      })
    })

    it('should return patterns for a specific file', () => {
      const patterns = store.getPatterns('src/auth.ts')
      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].count).toBe(3)
      expect(patterns[0].issue_type).toBe('security')
    })

    it('should return all patterns when no file specified', () => {
      const patterns = store.getPatterns()
      expect(patterns.length).toBe(2)
    })
  })

  describe('markResolved', () => {
    it('should mark an issue resolved without error', () => {
      const id = store.indexIssue({
        task_id: 'task-r',
        file_path: 'src/x.ts',
        issue_type: 'logic',
        description: 'off-by-one error',
        severity: 'critical',
        resolved: false,
      })
      expect(() => store.markResolved(id)).not.toThrow()
    })
  })

  describe('buildReviewHistoryContext', () => {
    it('should return empty string when store is empty', () => {
      const ctx = buildReviewHistoryContext(store, 'some query', ['src/foo.ts'])
      expect(ctx).toBe('')
    })

    it('should return a non-empty markdown block when history exists', () => {
      store.indexIssue({
        task_id: 'task-hist',
        file_path: 'src/component.ts',
        issue_type: 'security',
        description: 'eval usage is dangerous',
        severity: 'critical',
        resolved: false,
      })
      const ctx = buildReviewHistoryContext(store, 'security eval', ['src/component.ts'])
      expect(ctx).toContain('历史 Review')
      expect(ctx.length).toBeGreaterThan(0)
    })
  })

  describe('singleton', () => {
    it('getInstance returns the same instance', () => {
      ReviewMemoryStore.resetInstance()
      const a = ReviewMemoryStore.getInstance(testDbPath)
      const b = ReviewMemoryStore.getInstance(testDbPath)
      expect(a).toBe(b)
      a.close()
      ReviewMemoryStore.resetInstance()
    })
  })
})
