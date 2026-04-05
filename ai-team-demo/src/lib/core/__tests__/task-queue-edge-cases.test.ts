import { TaskQueue } from '../task-queue'

describe('TaskQueue - Edge Cases', () => {
  let queue: TaskQueue

  afterEach(async () => {
    queue?.abort()
    // Wait for any pending setTimeout in abort() to complete
    await new Promise(r => setTimeout(r, 10))
  })

  describe('invalid concurrency', () => {
    it('should reject tasks when concurrency is 0', async () => {
      queue = new TaskQueue({ concurrency: 0 })
      const promise = queue.add(async () => 'result')
      await new Promise(r => setTimeout(r, 50))
      expect(queue.getStats().pending).toBe(1)
      expect(queue.getStats().running).toBe(0)
      queue.abort()
      await expect(promise).rejects.toThrow('aborted')
    })

    it('should handle negative concurrency as 0 (tasks never start)', async () => {
      queue = new TaskQueue({ concurrency: -1 })
      const promise = queue.add(async () => 'result')
      await new Promise(r => setTimeout(r, 50))
      expect(queue.getStats().pending).toBe(1)
      expect(queue.getStats().running).toBe(0)
      queue.abort()
      await expect(promise).rejects.toThrow('aborted')
    })
  })

  describe('abort edge cases', () => {
    it('should be idempotent when abort is called multiple times', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const t1 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 50))
        return 'first'
      })
      const t2 = queue.add(async () => 'second')
      const t3 = queue.add(async () => 'third')

      await new Promise(r => setTimeout(r, 10))
      queue.abort()
      queue.abort()
      queue.abort()

      const results = await Promise.allSettled([t1, t2, t3])
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('rejected')
      expect(queue.isAborted()).toBe(true)
    })

    it('should resolve onIdle after abort', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const t1 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
      })
      t1.catch(() => {}) // Handle rejection from abort

      const t2 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
      })
      t2.catch(() => {}) // Handle rejection from abort

      const idlePromise = queue.onIdle()

      await new Promise(r => setTimeout(r, 10))
      queue.abort()

      await expect(idlePromise).resolves.toBeUndefined()
      // Wait for any pending setTimeout in abort() to complete
      await new Promise(r => setTimeout(r, 10))
    })

    it('should reject new tasks immediately after abort even if running tasks exist', async () => {
      queue = new TaskQueue({ concurrency: 2 })

      const t1Promise = queue.add(async () => {
        await new Promise(r => setTimeout(r, 200))
      })
      t1Promise.catch(() => {}) // Attach catch handler immediately

      await new Promise(r => setTimeout(r, 10))
      queue.abort()

      await expect(queue.add(async () => 'nope')).rejects.toThrow('aborted')
      await t1Promise.catch(() => {}) // Catch again to avoid unhandled rejection
      // Wait for any pending setTimeout in abort() to complete
      await new Promise(r => setTimeout(r, 10))
    })
  })

  describe('onIdle edge cases', () => {
    it('should handle multiple concurrent onIdle calls', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      queue.add(async () => {
        await new Promise(r => setTimeout(r, 30))
      })

      const idle1 = queue.onIdle()
      const idle2 = queue.onIdle()
      const idle3 = queue.onIdle()

      await Promise.all([idle1, idle2, idle3])

      const stats = queue.getStats()
      expect(stats.running).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.completed).toBe(1)
    })

    it('should resolve onIdle immediately on empty aborted queue', async () => {
      queue = new TaskQueue({ concurrency: 2 })
      queue.abort()
      await expect(queue.onIdle()).resolves.toBeUndefined()
    })
  })

  describe('timeout edge cases', () => {
    it('should not apply timeout when timeout is 0', async () => {
      queue = new TaskQueue({ concurrency: 1, defaultTimeout: 0 })

      const result = await queue.add(async () => {
        await new Promise(r => setTimeout(r, 50))
        return 'done'
      })

      expect(result).toBe('done')
    })

    it('should not apply timeout when timeout is negative', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const result = await queue.add(
        async () => {
          await new Promise(r => setTimeout(r, 50))
          return 'done'
        },
        { timeout: -100 }
      )

      expect(result).toBe('done')
    })

    it('should allow per-task timeout to override queue default of 0', async () => {
      queue = new TaskQueue({ concurrency: 1, defaultTimeout: 0 })

      await expect(
        queue.add(
          async () => {
            await new Promise(r => setTimeout(r, 5000))
            return 'never'
          },
          { timeout: 30 }
        )
      ).rejects.toThrow('timeout')
    })
  })

  describe('addAll edge cases', () => {
    it('should return empty array for empty input', async () => {
      queue = new TaskQueue({ concurrency: 2 })
      const results = await queue.addAll([])
      expect(results).toEqual([])
    })

    it('should handle addAll on aborted queue', async () => {
      queue = new TaskQueue({ concurrency: 2 })
      queue.abort()

      await expect(
        queue.addAll([async () => 1, async () => 2])
      ).rejects.toThrow('aborted')
    })

    it('should preserve order even with different execution times', async () => {
      queue = new TaskQueue({ concurrency: 3 })

      const fns = [
        async () => { await new Promise(r => setTimeout(r, 50)); return 'slow' },
        async () => 'fast',
        async () => { await new Promise(r => setTimeout(r, 30)); return 'medium' },
      ]

      const results = await queue.addAll(fns)
      expect(results).toEqual(['slow', 'fast', 'medium'])
    })
  })

  describe('non-Error rejection handling', () => {
    it('should wrap string rejection in Error', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      await expect(
        queue.add(async () => {
          throw 'string error'
        })
      ).rejects.toThrow('string error')
    })

    it('should wrap number rejection in Error', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      await expect(
        queue.add(async () => {
          throw 42
        })
      ).rejects.toThrow('42')
    })

    it('should wrap null rejection in Error', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      await expect(
        queue.add(async () => {
          throw null
        })
      ).rejects.toThrow('null')
    })

    it('should wrap undefined rejection in Error', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      await expect(
        queue.add(async () => {
          throw undefined
        })
      ).rejects.toThrow('undefined')
    })
  })

  describe('stats accuracy under edge conditions', () => {
    it('should maintain correct stats after timeout + normal completion', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const t1 = queue.add(
        async () => {
          await new Promise(r => setTimeout(r, 5000))
          return 'timeout'
        },
        { timeout: 30 }
      )
      const t2 = queue.add(async () => 'ok')

      await expect(t1).rejects.toThrow('timeout')
      await expect(t2).resolves.toBe('ok')

      const stats = queue.getStats()
      expect(stats.failed).toBe(1)
      expect(stats.completed).toBe(1)
      expect(stats.running).toBe(0)
      expect(stats.pending).toBe(0)
    })

    it('should maintain correct stats after abort with running tasks', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const t1 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 30))
        return 'done'
      })
      const t2 = queue.add(async () => {
        await new Promise(r => setTimeout(r, 200))
        return 'slow'
      }).catch(() => {})
      const t3 = queue.add(async () => 'pending')

      await new Promise(r => setTimeout(r, 50))
      queue.abort()

      const results = await Promise.allSettled([t1, t2, t3])
      expect(results[0].status).toBe('fulfilled')
      expect(results[2].status).toBe('rejected')
    })

    it('should count correctly after many rapid add/complete cycles', async () => {
      queue = new TaskQueue({ concurrency: 5 })

      const tasks = Array.from({ length: 100 }, (_, i) =>
        queue.add(async () => i)
      )

      const results = await Promise.allSettled(tasks)
      const stats = queue.getStats()
      expect(stats.completed).toBe(100)
      expect(stats.failed).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.running).toBe(0)
    })
  })

  describe('task returning undefined/null', () => {
    it('should handle task returning undefined', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const result = await queue.add(async () => {
        return undefined
      })

      expect(result).toBeUndefined()
    })

    it('should handle task returning null', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const result = await queue.add<null>(async () => null)

      expect(result).toBeNull()
    })
  })

  describe('rapid add after processNext', () => {
    it('should correctly process tasks added in rapid succession', async () => {
      queue = new TaskQueue({ concurrency: 1 })
      const order: number[] = []

      for (let i = 0; i < 5; i++) {
        queue.add(async () => {
          order.push(i)
          await new Promise(r => setTimeout(r, 10))
        })
      }

      await queue.onIdle()
      expect(order).toEqual([0, 1, 2, 3, 4])
    })
  })
})
