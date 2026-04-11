/**
 * Tests: TaskCheckpointStore + CheckpointService
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { TaskCheckpointStore, buildCheckpoint } from '../checkpoint-store'
import { CheckpointService } from '../checkpoint-service'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claw-checkpoint-'))
  TaskCheckpointStore.resetInstance()
  CheckpointService.resetInstance()
})

afterEach(() => {
  TaskCheckpointStore.resetInstance()
  CheckpointService.resetInstance()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ─── TaskCheckpointStore ──────────────────────────────────────

describe('TaskCheckpointStore', () => {
  const dbPath = () => path.join(tmpDir, 'checkpoints.db')

  it('should create and retrieve a checkpoint', () => {
    const store = new TaskCheckpointStore(dbPath())
    const cp = buildCheckpoint('task-1', 'running', 'initial', { userMessage: 'hello' })
    const saved = store.save(cp)

    expect(saved.id).toBeDefined()
    expect(saved.task_id).toBe('task-1')
    expect(saved.status).toBe('running')
    expect(saved.stage).toBe('initial')

    const latest = store.getLatest('task-1')
    expect(latest).not.toBeNull()
    expect(latest!.status).toBe('running')
    store.close()
  })

  it('should upsert when same task_id + stage is saved again', () => {
    const store = new TaskCheckpointStore(dbPath())
    store.save(buildCheckpoint('task-2', 'running', 'pm', {}))
    store.save(buildCheckpoint('task-2', 'pm_complete', 'pm', { pmMessage: 'analysis done' }))

    const all = store.getAll('task-2')
    // Should have only one record for 'pm' stage (upserted)
    const pmRecords = all.filter(c => c.stage === 'pm')
    expect(pmRecords).toHaveLength(1)
    expect(pmRecords[0].status).toBe('pm_complete')
    store.close()
  })

  it('should create separate records for different stages', () => {
    const store = new TaskCheckpointStore(dbPath())
    store.save(buildCheckpoint('task-3', 'running', 'initial', {}))
    store.save(buildCheckpoint('task-3', 'pm_complete', 'pm', {}))
    store.save(buildCheckpoint('task-3', 'dev_complete', 'dev', {}))

    const all = store.getAll('task-3')
    expect(all).toHaveLength(3)
    store.close()
  })

  it('should return null for unknown task', () => {
    const store = new TaskCheckpointStore(dbPath())
    expect(store.getLatest('nonexistent')).toBeNull()
    store.close()
  })

  it('should parse agent_outputs JSON', () => {
    const store = new TaskCheckpointStore(dbPath())
    const outputs = { userMessage: 'test msg', pmAnalysis: 'analysis' }
    store.save(buildCheckpoint('task-4', 'pm_complete', 'pm', outputs))
    const latest = store.getLatest('task-4')!
    const parsed = store.parseOutputs(latest)
    expect(parsed.userMessage).toBe('test msg')
    expect(parsed.pmAnalysis).toBe('analysis')
    store.close()
  })

  it('should persist data across instances (DB durability)', () => {
    const p = dbPath()
    const store1 = new TaskCheckpointStore(p)
    store1.save(buildCheckpoint('task-5', 'pm_complete', 'pm', { pmMessage: 'done' }))
    store1.close()

    // New instance reading same DB
    const store2 = new TaskCheckpointStore(p)
    const cp = store2.getLatest('task-5')
    expect(cp).not.toBeNull()
    expect(cp!.status).toBe('pm_complete')
    store2.close()
  })

  it('should list resumable checkpoints', () => {
    const store = new TaskCheckpointStore(dbPath())
    store.save(buildCheckpoint('task-6', 'pm_complete', 'pm', { subTasks: [{}] }))
    store.save(buildCheckpoint('task-7', 'completed', 'review', {}))
    store.save(buildCheckpoint('task-8', 'failed', 'dev', {}))

    const resumable = store.getResumable()
    const ids = resumable.map(c => c.task_id)
    expect(ids).toContain('task-6')
    expect(ids).not.toContain('task-7')
    expect(ids).not.toContain('task-8')
    store.close()
  })

  it('should track total count', () => {
    const store = new TaskCheckpointStore(dbPath())
    expect(store.getTotalCount()).toBe(0)
    store.save(buildCheckpoint('task-9', 'running', 'initial', {}))
    expect(store.getTotalCount()).toBe(1)
    store.close()
  })
})

// ─── CheckpointService ────────────────────────────────────────

describe('CheckpointService', () => {
  const dbPath = () => path.join(tmpDir, 'service.db')

  it('should save and query initial checkpoint', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveInitial('workflow-1', 'Build me an app')

    const status = cs.getStatus('workflow-1')
    expect(status.found).toBe(true)
    expect(status.status).toBe('running')
    expect(status.outputs.userMessage).toBe('Build me an app')
  })

  it('should save PM complete checkpoint', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveInitial('wf-2', 'msg')
    cs.savePMComplete('wf-2', 'pm done', 'analysis text', [{ title: 't1' }])

    const resume = cs.getResumePoint('wf-2')
    expect(resume.point).toBe('after_pm')
    expect(resume.outputs.subTasks).toHaveLength(1)
  })

  it('should return completed for done workflows', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveInitial('wf-3', 'msg')
    cs.savePMComplete('wf-3', 'done', '', [{ title: 'sub' }])
    cs.saveCompleted('wf-3')

    const resume = cs.getResumePoint('wf-3')
    expect(resume.point).toBe('completed')
  })

  it('should return failed point for failed workflows', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveInitial('wf-4', 'msg')
    cs.saveError('wf-4', 'LLM timeout')

    const resume = cs.getResumePoint('wf-4')
    expect(resume.point).toBe('failed')
    expect(resume.outputs.error).toBe('LLM timeout')
  })

  it('should return fresh when no checkpoint exists', () => {
    const cs = new CheckpointService(dbPath())
    const resume = cs.getResumePoint('nonexistent')
    expect(resume.point).toBe('fresh')
    expect(resume.checkpoint).toBeNull()
  })

  it('getResumable should list only resumable tasks', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveInitial('r1', 'msg1')
    cs.savePMComplete('r1', 'pm', '', [{}])
    cs.saveInitial('r2', 'msg2')
    cs.saveCompleted('r2')

    const resumable = cs.getResumable()
    const ids = resumable.map(t => t.taskId)
    expect(ids).toContain('r1')
    expect(ids).not.toContain('r2')
  })

  it('should save dev complete checkpoint', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveDevComplete('sub-1', 'code written', [{ path: 'src/a.ts', content: 'export {}' }])

    const status = cs.getStatus('sub-1')
    expect(status.status).toBe('dev_complete')
    expect(status.outputs.devFiles).toHaveLength(1)
  })

  it('should save review complete (approved)', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveReviewComplete('sub-2', true, 'LGTM', undefined)

    const status = cs.getStatus('sub-2')
    expect(status.status).toBe('review_complete')
    expect(status.outputs.reviewApproved).toBe(true)
  })

  it('should save review complete (rejected → back to dev_complete)', () => {
    const cs = new CheckpointService(dbPath())
    cs.saveReviewComplete('sub-3', false, 'needs work', 'fix the null check')

    const status = cs.getStatus('sub-3')
    expect(status.status).toBe('dev_complete')
    expect(status.outputs.reviewApproved).toBe(false)
    expect(status.outputs.reviewFeedback).toBe('fix the null check')
  })
})
