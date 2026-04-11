/**
 * CheckpointService — 在 Orchestrator 工作流各阶段保存断点，支持恢复
 *
 * 使用方式（集成到 Orchestrator）：
 *   const cs = CheckpointService.getInstance()
 *   await cs.saveInitial(taskId, userMessage)
 *   await cs.savePMComplete(taskId, pmMessage, pmAnalysis, subTasks)
 *   await cs.saveDevComplete(taskId, devMessage, files)
 *   await cs.saveReviewComplete(taskId, approved, feedback)
 *   await cs.saveCompleted(taskId)   // or saveError(taskId, error)
 */

import {
  TaskCheckpointStore,
  TaskCheckpoint,
  CheckpointStatus,
  CheckpointAgentOutputs,
  buildCheckpoint,
} from './checkpoint-store'

export class CheckpointService {
  private store: TaskCheckpointStore
  private static instance: CheckpointService | null = null

  constructor(dbPath?: string) {
    this.store = new TaskCheckpointStore(dbPath)
  }

  static getInstance(dbPath?: string): CheckpointService {
    if (!CheckpointService.instance) {
      CheckpointService.instance = new CheckpointService(dbPath)
    }
    return CheckpointService.instance
  }

  static resetInstance(): void {
    CheckpointService.instance = null
    TaskCheckpointStore.resetInstance()
  }

  // ─── Save helpers ─────────────────────────────────────────────

  /** 任务开始（initial） */
  saveInitial(taskId: string, userMessage: string): void {
    this.store.save(buildCheckpoint(taskId, 'running', 'initial', { userMessage }))
  }

  /** PM 分析完成 */
  savePMComplete(
    taskId: string,
    pmMessage: string,
    pmAnalysis: string,
    subTasks: unknown[],
  ): void {
    this.store.save(buildCheckpoint(taskId, 'pm_complete', 'pm', {
      pmMessage,
      pmAnalysis,
      subTasks,
    }))
  }

  /** Dev 实现完成（单个 sub-task） */
  saveDevComplete(
    taskId: string,
    devMessage: string,
    files: Array<{ path: string; content: string }>,
  ): void {
    this.store.save(buildCheckpoint(taskId, 'dev_complete', 'dev', {
      devMessage,
      devFiles: files,
    }))
  }

  /** Review 完成（单个 sub-task） */
  saveReviewComplete(
    taskId: string,
    approved: boolean,
    reviewMessage: string,
    feedback?: string,
  ): void {
    const status: CheckpointStatus = approved ? 'review_complete' : 'dev_complete'
    this.store.save(buildCheckpoint(taskId, status, 'review', {
      reviewApproved: approved,
      reviewMessage,
      reviewFeedback: feedback,
    }))
  }

  /** 整个工作流完成 */
  saveCompleted(taskId: string): void {
    const existing = this.store.getLatest(taskId)
    const prevOutputs: CheckpointAgentOutputs = existing
      ? this.store.parseOutputs(existing)
      : {}
    this.store.save(buildCheckpoint(taskId, 'completed', 'review', prevOutputs))
  }

  /** 任务失败 */
  saveError(taskId: string, error: string): void {
    const existing = this.store.getLatest(taskId)
    const prevOutputs: CheckpointAgentOutputs = existing
      ? this.store.parseOutputs(existing)
      : {}
    this.store.save(buildCheckpoint(taskId, 'failed', existing?.stage ?? 'initial', {
      ...prevOutputs,
      error,
    }))
  }

  // ─── Query helpers ────────────────────────────────────────────

  /** 查询任务最新状态 */
  getStatus(taskId: string): {
    found: boolean
    status: CheckpointStatus | null
    stage: string | null
    outputs: CheckpointAgentOutputs
    updatedAt: number | null
  } {
    const cp = this.store.getLatest(taskId)
    if (!cp) {
      return { found: false, status: null, stage: null, outputs: {}, updatedAt: null }
    }
    return {
      found: true,
      status: cp.status,
      stage: cp.stage,
      outputs: this.store.parseOutputs(cp),
      updatedAt: cp.updated_at,
    }
  }

  /** 获取完整 checkpoint 列表（用于 resume 决策） */
  getCheckpoints(taskId: string): TaskCheckpoint[] {
    return this.store.getAll(taskId)
  }

  /** 获取可恢复任务列表 */
  getResumable(): Array<{
    taskId: string
    status: CheckpointStatus
    stage: string
    updatedAt: number
    outputs: CheckpointAgentOutputs
  }> {
    return this.store.getResumable().map(cp => ({
      taskId: cp.task_id,
      status: cp.status,
      stage: cp.stage,
      updatedAt: cp.updated_at,
      outputs: this.store.parseOutputs(cp),
    }))
  }

  /**
   * 判断是否可以断点续传，返回恢复点信息
   * - 'fresh'          → 无 checkpoint，从头开始
   * - 'after_pm'       → PM 已完成，可跳过 PM 直接分配子任务
   * - 'completed'      → 已完成，无需重跑
   * - 'failed'         → 已失败，需要重跑
   */
  getResumePoint(taskId: string): {
    point: 'fresh' | 'after_pm' | 'completed' | 'failed'
    checkpoint: TaskCheckpoint | null
    outputs: CheckpointAgentOutputs
  } {
    const cp = this.store.getLatest(taskId)
    if (!cp) {
      return { point: 'fresh', checkpoint: null, outputs: {} }
    }

    const outputs = this.store.parseOutputs(cp)

    if (cp.status === 'completed') {
      return { point: 'completed', checkpoint: cp, outputs }
    }

    if (cp.status === 'failed') {
      return { point: 'failed', checkpoint: cp, outputs }
    }

    if (cp.status === 'pm_complete' && outputs.subTasks && Array.isArray(outputs.subTasks)) {
      return { point: 'after_pm', checkpoint: cp, outputs }
    }

    // running/dev_complete/review_complete → treat as fresh (re-run from PM)
    return { point: 'fresh', checkpoint: cp, outputs }
  }
}
