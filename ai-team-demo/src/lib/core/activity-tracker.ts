function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export interface ActivityLog {
  id: string
  agentId: string
  action: string
  input: unknown
  output: unknown
  timestamp: Date
  duration: number
  success: boolean
  error?: string
}

export interface AgentStats {
  totalActivities: number
  successfulActivities: number
  failedActivities: number
  averageDuration: number
}

export interface ActivityContext {
  activityId: string
  end: (result: { output?: unknown; success?: boolean; error?: string }) => void
}

export class ActivityTracker {
  private logs: ActivityLog[] = []

  track(agentId: string, action: string, input: unknown): ActivityContext {
    const activityId = generateId()
    const startTime = Date.now()
    let logIndex: number

    const log: ActivityLog = {
      id: activityId,
      agentId: agentId || 'unknown',
      action: action || 'unknown',
      input,
      output: undefined,
      timestamp: new Date(),
      duration: 0,
      success: true,
      error: undefined,
    }
    this.logs.push(log)
    logIndex = this.logs.length - 1

    const context: ActivityContext = {
      activityId,
      end: (result: { output?: unknown; success?: boolean; error?: string }) => {
        const duration = Date.now() - startTime
        this.logs[logIndex] = {
          ...this.logs[logIndex],
          output: result.output,
          timestamp: new Date(),
          duration,
          success: result.success !== false,
          error: result.error,
        }
      },
    }

    return context
  }

  getHistory(agentId?: string, limit?: number): ActivityLog[] {
    let logs = agentId
      ? this.logs.filter(log => log.agentId === agentId)
      : [...this.logs]

    logs = logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (limit && limit > 0) {
      logs = logs.slice(0, limit)
    }

    return logs
  }

  getStats(agentId: string): AgentStats {
    const logs = this.logs.filter(log => log.agentId === agentId)
    
    if (logs.length === 0) {
      return {
        totalActivities: 0,
        successfulActivities: 0,
        failedActivities: 0,
        averageDuration: 0,
      }
    }

    const successful = logs.filter(log => log.success).length
    const failed = logs.filter(log => !log.success).length
    const totalDuration = logs.reduce((sum, log) => sum + log.duration, 0)

    return {
      totalActivities: logs.length,
      successfulActivities: successful,
      failedActivities: failed,
      averageDuration: totalDuration / logs.length,
    }
  }
}
