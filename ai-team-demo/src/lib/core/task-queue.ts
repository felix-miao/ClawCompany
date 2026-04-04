type Priority = 'low' | 'medium' | 'high'

const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export interface TaskQueueOptions {
  concurrency?: number
  defaultTimeout?: number
}

export interface TaskOptions {
  priority?: Priority
  timeout?: number
}

interface InternalTask<T = unknown> {
  fn: () => Promise<T>
  priority: Priority
  sequence: number
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeout?: number
}

export interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
}

export class TaskQueue {
  private concurrency: number
  private defaultTimeout: number | undefined
  private pending: InternalTask[] = []
  private running = 0
  private completed = 0
  private failed = 0
  private sequence = 0
  private aborted = false
  private idleResolvers: Array<() => void> = []

  constructor(options: TaskQueueOptions = {}) {
    this.concurrency = options.concurrency ?? 3
    this.defaultTimeout = options.defaultTimeout
  }

  add<T>(fn: () => Promise<T>, options?: TaskOptions): Promise<T> {
    if (this.aborted) {
      return Promise.reject(new Error('Queue aborted'))
    }

    return new Promise<T>((resolve, reject) => {
      const task: InternalTask<T> = {
        fn,
        priority: options?.priority ?? 'medium',
        sequence: this.sequence++,
        resolve,
        reject,
        timeout: options?.timeout ?? this.defaultTimeout,
      }

      this.pending.push(task as InternalTask)
      this.pending.sort((a, b) => {
        const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
        if (diff !== 0) return diff
        return a.sequence - b.sequence
      })

      this.processNext()
    })
  }

  async addAll<T>(fns: Array<() => Promise<T>>, options?: TaskOptions): Promise<T[]> {
    const tasks = fns.map(fn => this.add(fn, options))
    return Promise.all(tasks)
  }

  onIdle(): Promise<void> {
    if (this.running === 0 && this.pending.length === 0) {
      return Promise.resolve()
    }
    return new Promise<void>(resolve => {
      this.idleResolvers.push(resolve)
    })
  }

  abort(): void {
    this.aborted = true
    while (this.pending.length > 0) {
      const task = this.pending.shift()!
      task.reject(new Error('Queue aborted'))
    }
  }

  isAborted(): boolean {
    return this.aborted
  }

  getStats(): QueueStats {
    return {
      pending: this.pending.length,
      running: this.running,
      completed: this.completed,
      failed: this.failed,
    }
  }

  getConcurrency(): number {
    return this.concurrency
  }

  private processNext(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!
      this.running++
      this.executeTask(task)
    }
  }

  private async executeTask(task: InternalTask): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const taskPromise = (async () => {
      try {
        const result = await task.fn()
        task.resolve(result)
        this.completed++
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        task.reject(err)
        this.failed++
      } finally {
        this.running--
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
        this.checkIdle()
        this.processNext()
      }
    })()

    if (task.timeout !== undefined && task.timeout > 0) {
      timeoutId = setTimeout(() => {
        task.reject(new Error(`Task timeout after ${task.timeout}ms`))
      }, task.timeout)
    }

    await taskPromise
  }

  private checkIdle(): void {
    if (this.running === 0 && this.pending.length === 0) {
      const resolvers = this.idleResolvers
      this.idleResolvers = []
      resolvers.forEach(r => r())
    }
  }
}
