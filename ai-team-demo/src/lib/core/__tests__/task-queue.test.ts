import { TaskQueue } from '../task-queue'

describe('TaskQueue', () => {
  let queue: TaskQueue

  afterEach(() => {
    queue?.abort()
  })

  describe('bounded concurrency', () => {
    it('should respect concurrency limit and not exceed it', async () => {
      const concurrency = 2
      queue = new TaskQueue({ concurrency })
      let currentRunning = 0
      let maxRunning = 0

      const tasks = Array.from({ length: 10 }, (_, i) =>
        queue.add(async () => {
          currentRunning++
          maxRunning = Math.max(maxRunning, currentRunning)
          await new Promise(r => setTimeout(r, 20))
          currentRunning--
          return i
        })
      )

      await Promise.all(tasks)
      expect(maxRunning).toBeLessThanOrEqual(concurrency)
      expect(maxRunning).toBe(concurrency)
    })

    it('should execute all tasks even with concurrency of 1', async () => {
      queue = new TaskQueue({ concurrency: 1 })
      const results: number[] = []

      const tasks = Array.from({ length: 5 }, (_, i) =>
        queue.add(async () => {
          results.push(i)
          await new Promise(r => setTimeout(r, 5))
          return i
        })
      )

      const settled = await Promise.allSettled(tasks)
      expect(results.length).toBe(5)
      expect(settled.every(r => r.status === 'fulfilled')).toBe(true)
    })

    it('should handle empty queue', () => {
      queue = new TaskQueue({ concurrency: 3 })
      const stats = queue.getStats()
      expect(stats.pending).toBe(0)
      expect(stats.running).toBe(0)
      expect(stats.completed).toBe(0)
    })

    it('should execute tasks with default concurrency of 3', async () => {
      queue = new TaskQueue({ concurrency: 3 })
      let currentRunning = 0
      let maxRunning = 0

      const tasks = Array.from({ length: 8 }, (_, i) =>
        queue.add(async () => {
          currentRunning++
          maxRunning = Math.max(maxRunning, currentRunning)
          await new Promise(r => setTimeout(r, 10))
          currentRunning--
          return i
        })
      )

      await Promise.all(tasks)
      expect(maxRunning).toBeLessThanOrEqual(3)
      expect(maxRunning).toBe(3)
    })
  })

  describe('priority scheduling', () => {
    it('should execute higher priority tasks first when slot available', async () => {
      queue = new TaskQueue({ concurrency: 1 })
      const executionOrder: string[] = []

      const blocker = queue.add(async () => {
        await new Promise(r => setTimeout(r, 50))
        executionOrder.push('blocker')
      }, { priority: 'low' })

      const high = queue.add(async () => {
        executionOrder.push('high')
      }, { priority: 'high' })

      const medium = queue.add(async () => {
        executionOrder.push('medium')
      }, { priority: 'medium' })

      await Promise.all([blocker, high, medium])
      expect(executionOrder).toEqual(['blocker', 'high', 'medium'])
    })

    it('should process same-priority tasks in FIFO order', async () => {
      queue = new TaskQueue({ concurrency: 1 })
      const executionOrder: string[] = []

      const tasks = ['first', 'second', 'third'].map(name =>
        queue.add(async () => {
          await new Promise(r => setTimeout(r, 10))
          executionOrder.push(name)
        })
      )

      await Promise.all(tasks)
      expect(executionOrder).toEqual(['first', 'second', 'third'])
    })

    it('should sort mixed priorities correctly', async () => {
      queue = new TaskQueue({ concurrency: 1 })
      const executionOrder: string[] = []

      queue.add(async () => {
        await new Promise(r => setTimeout(r, 30))
        executionOrder.push('low-1')
      }, { priority: 'low' })

      queue.add(async () => {
        executionOrder.push('high-1')
      }, { priority: 'high' })

      queue.add(async () => {
        executionOrder.push('low-2')
      }, { priority: 'low' })

      queue.add(async () => {
        executionOrder.push('high-2')
      }, { priority: 'high' })

      await queue.onIdle()
      expect(executionOrder).toEqual(['low-1', 'high-1', 'high-2', 'low-2'])
    })
  })

  describe('per-task timeout', () => {
    it('should reject task that exceeds timeout', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      await expect(
        queue.add(
          async () => {
            await new Promise(r => setTimeout(r, 10000))
            return 'never'
          },
          { timeout: 50 }
        )
      ).rejects.toThrow('timeout')
    })

    it('should allow tasks that complete within timeout', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const result = await queue.add(
        async () => {
          await new Promise(r => setTimeout(r, 10))
          return 'done'
        },
        { timeout: 500 }
      )

      expect(result).toBe('done')
    })

    it('should use default timeout from queue options', async () => {
      queue = new TaskQueue({ concurrency: 1, defaultTimeout: 50 })

      await expect(
        queue.add(async () => {
          await new Promise(r => setTimeout(r, 10000))
          return 'never'
        })
      ).rejects.toThrow('timeout')
    })
  })

  describe('abort / cancellation', () => {
    it('should cancel pending tasks on abort', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const first = queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
        return 'first'
      })

      const second = queue.add(async () => 'second')
      const third = queue.add(async () => 'third')

      await new Promise(r => setTimeout(r, 10))
      queue.abort()

      const results = await Promise.allSettled([first, second, third])
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('rejected')
    })

    it('should reject new tasks after abort', async () => {
      queue = new TaskQueue({ concurrency: 2 })
      queue.abort()

      await expect(queue.add(async () => 'nope')).rejects.toThrow('aborted')
    })

    it('should set aborted flag', () => {
      queue = new TaskQueue({ concurrency: 2 })
      expect(queue.isAborted()).toBe(false)
      queue.abort()
      expect(queue.isAborted()).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should propagate task errors to caller', async () => {
      queue = new TaskQueue({ concurrency: 2 })

      await expect(
        queue.add(async () => {
          throw new Error('task error')
        })
      ).rejects.toThrow('task error')
    })

    it('should continue processing other tasks after one fails', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      const t1 = queue.add(async () => {
        throw new Error('fail')
      })

      await expect(t1).rejects.toThrow('fail')

      const t2 = queue.add(async () => 'ok')
      await expect(t2).resolves.toBe('ok')
    })

    it('should handle sync thrown errors', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      await expect(
        queue.add(() => {
          throw new Error('sync error')
        })
      ).rejects.toThrow('sync error')
    })

    it('should handle parallel task failures independently', async () => {
      queue = new TaskQueue({ concurrency: 2 })

      const t1 = queue.add(async () => {
        throw new Error('fail-1')
      })
      const t2 = queue.add(async () => 'ok')
      const t3 = queue.add(async () => {
        throw new Error('fail-2')
      })

      const results = await Promise.allSettled([t1, t2, t3])
      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('fulfilled')
      expect(results[2].status).toBe('rejected')
    })
  })

  describe('stats tracking', () => {
    it('should track completed and failed counts', async () => {
      queue = new TaskQueue({ concurrency: 2 })

      const tasks = [
        queue.add(async () => 1),
        queue.add(async () => { throw new Error('fail') }),
        queue.add(async () => 3),
      ]

      await Promise.allSettled(tasks)
      const stats = queue.getStats()
      expect(stats.completed).toBe(2)
      expect(stats.failed).toBe(1)
    })

    it('should show running and pending during execution', async () => {
      queue = new TaskQueue({ concurrency: 1 })

      queue.add(async () => {
        await new Promise(r => setTimeout(r, 100))
      })
      queue.add(async () => {})
      queue.add(async () => {})

      await new Promise(r => setTimeout(r, 10))
      const stats = queue.getStats()
      expect(stats.running).toBe(1)
      expect(stats.pending).toBe(2)

      await queue.onIdle()
    })
  })

  describe('addAll - batch execution', () => {
    it('should execute a batch of tasks with bounded concurrency', async () => {
      queue = new TaskQueue({ concurrency: 2 })
      let maxRunning = 0
      let currentRunning = 0

      const fns = Array.from({ length: 6 }, (_, i) => async () => {
        currentRunning++
        maxRunning = Math.max(maxRunning, currentRunning)
        await new Promise(r => setTimeout(r, 10))
        currentRunning--
        return i
      })

      const results = await queue.addAll(fns)
      expect(results).toEqual([0, 1, 2, 3, 4, 5])
      expect(maxRunning).toBeLessThanOrEqual(2)
    })

    it('should throw if any batch task fails', async () => {
      queue = new TaskQueue({ concurrency: 2 })

      const fns = [
        async () => 1,
        async () => { throw new Error('batch fail') },
        async () => 3,
      ]

      await expect(queue.addAll(fns)).rejects.toThrow('batch fail')
    })
  })

  describe('onIdle', () => {
    it('should resolve immediately when queue is empty', async () => {
      queue = new TaskQueue({ concurrency: 2 })
      await expect(queue.onIdle()).resolves.toBeUndefined()
    })

    it('should resolve when all tasks complete', async () => {
      queue = new TaskQueue({ concurrency: 2 })

      queue.add(async () => {
        await new Promise(r => setTimeout(r, 30))
      })
      queue.add(async () => {
        await new Promise(r => setTimeout(r, 60))
      })

      await queue.onIdle()
      const stats = queue.getStats()
      expect(stats.running).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.completed).toBe(2)
    })
  })

  describe('default options', () => {
    it('should use default concurrency of 3', () => {
      queue = new TaskQueue()
      expect(queue.getConcurrency()).toBe(3)
    })

    it('should accept options without concurrency', () => {
      queue = new TaskQueue({ defaultTimeout: 5000 })
      expect(queue.getConcurrency()).toBe(3)
    })
  })
})
