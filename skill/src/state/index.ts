/**
 * State Management System - 状态管理系统
 * 
 * 功能：
 * - 状态持久化（内存/文件）
 * - 状态快照
 * - 状态回滚
 * - 状态历史
 * - 任务状态机（三省六部架构）
 */

import * as fs from 'fs'
import * as path from 'path'

// ============ 通用状态管理器 ============

/**
 * 状态快照
 */
export interface StateSnapshot<T> {
  id: string
  timestamp: string
  data: T
  metadata: {
    version: string
    description?: string
    tags?: string[]
  }
}

/**
 * 状态变更记录
 */
export interface StateChange<T> {
  id: string
  key: string  // 状态键
  timestamp: string
  previousValue: T | undefined
  newValue: T
  operation: 'set' | 'delete' | 'clear'
}

/**
 * 状态管理器配置
 */
export interface StateManagerOptions {
  /** 持久化类型 */
  persistence?: 'memory' | 'file'
  /** 文件存储路径（persistence='file' 时） */
  storagePath?: string
  /** 最大历史记录数 */
  maxHistorySize?: number
  /** 最大快照数 */
  maxSnapshots?: number
  /** 自动保存间隔（ms，0 表示禁用） */
  autoSaveInterval?: number
}

/**
 * 默认配置
 */
const DEFAULT_OPTIONS: Required<StateManagerOptions> = {
  persistence: 'memory',
  storagePath: './state-storage',
  maxHistorySize: 100,
  maxSnapshots: 50,
  autoSaveInterval: 0
}

/**
 * 状态管理器
 */
export class StateManager<T = any> {
  private state: Map<string, T> = new Map()
  private snapshots: Map<string, StateSnapshot<T>> = new Map()
  private history: StateChange<T>[] = []
  private options: Required<StateManagerOptions>
  private autoSaveTimer?: NodeJS.Timeout

  constructor(options: StateManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    
    if (this.options.persistence === 'file') {
      this.ensureStorageDirectory()
      this.loadFromFile()
      this.startAutoSave()
    }
  }

  /**
   * 设置状态值
   */
  set(key: string, value: T): void {
    const previousValue = this.state.get(key)
    this.state.set(key, value)
    
    // 记录变更历史
    this.recordChange({
      id: this.generateId(),
      key,
      timestamp: new Date().toISOString(),
      previousValue,
      newValue: value,
      operation: 'set'
    })
  }

  /**
   * 获取状态值
   */
  get(key: string): T | undefined {
    return this.state.get(key)
  }

  /**
   * 检查状态是否存在
   */
  has(key: string): boolean {
    return this.state.has(key)
  }

  /**
   * 删除状态值
   */
  delete(key: string): boolean {
    const previousValue = this.state.get(key)
    const deleted = this.state.delete(key)
    
    if (deleted) {
      this.recordChange({
        id: this.generateId(),
        key,
        timestamp: new Date().toISOString(),
        previousValue,
        newValue: undefined as any,
        operation: 'delete'
      })
    }
    
    return deleted
  }

  /**
   * 清空所有状态
   */
  clear(): void {
    const previousState = new Map(this.state)
    this.state.clear()
    
    this.recordChange({
      id: this.generateId(),
      key: '__all__',  // 特殊标记，表示清空所有
      timestamp: new Date().toISOString(),
      previousValue: Object.fromEntries(previousState) as any,
      newValue: {} as any,
      operation: 'clear'
    })
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    return Array.from(this.state.keys())
  }

  /**
   * 获取所有值
   */
  values(): T[] {
    return Array.from(this.state.values())
  }

  /**
   * 获取所有条目
   */
  entries(): [string, T][] {
    return Array.from(this.state.entries())
  }

  /**
   * 创建快照
   */
  createSnapshot(description?: string, tags?: string[]): string {
    const id = this.generateId()
    const snapshot: StateSnapshot<T> = {
      id,
      timestamp: new Date().toISOString(),
      data: Object.fromEntries(this.state) as any,
      metadata: {
        version: '1.0.0',
        description,
        tags
      }
    }
    
    this.snapshots.set(id, snapshot)
    
    // 限制快照数量
    if (this.snapshots.size > this.options.maxSnapshots) {
      const oldestId = this.getOldestSnapshotId()
      if (oldestId) {
        this.snapshots.delete(oldestId)
      }
    }
    
    console.log(`📸 创建快照: ${id}`)
    return id
  }

  /**
   * 恢复到快照
   */
  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId)
    if (!snapshot) {
      console.error(`❌ 快照不存在: ${snapshotId}`)
      return false
    }
    
    // 创建当前状态的快照（用于回滚）
    const rollbackId = this.createSnapshot('自动备份（恢复前）', ['auto', 'rollback'])
    
    // 恢复快照数据
    this.state.clear()
    const snapshotData = snapshot.data as Record<string, T>
    Object.entries(snapshotData).forEach(([key, value]) => {
      this.state.set(key, value)
    })
    
    console.log(`✅ 恢复到快照: ${snapshotId}`)
    console.log(`🔄 回滚快照: ${rollbackId}`)
    return true
  }

  /**
   * 获取所有快照
   */
  getSnapshots(): StateSnapshot<T>[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /**
   * 删除快照
   */
  deleteSnapshot(snapshotId: string): boolean {
    const deleted = this.snapshots.delete(snapshotId)
    if (deleted) {
      console.log(`🗑️ 删除快照: ${snapshotId}`)
    }
    return deleted
  }

  /**
   * 回滚到上一次变更
   */
  rollback(): boolean {
    if (this.history.length === 0) {
      console.warn('⚠️ 没有历史记录可以回滚')
      return false
    }
    
    const lastChange = this.history.pop()
    if (!lastChange) return false
    
    switch (lastChange.operation) {
      case 'set':
        if (lastChange.previousValue === undefined) {
          this.state.delete(lastChange.key)
        } else {
          this.state.set(lastChange.key, lastChange.previousValue)
        }
        break
      
      case 'delete':
        if (lastChange.previousValue !== undefined) {
          this.state.set(lastChange.key, lastChange.previousValue)
        }
        break
      
      case 'clear':
        Object.entries(lastChange.previousValue as any).forEach(([key, value]) => {
          this.state.set(key, value as T)
        })
        break
    }
    
    console.log(`⏪ 回滚变更: ${lastChange.operation}`)
    return true
  }

  /**
   * 回滚到指定次数前
   */
  rollbackN(n: number): number {
    let rolledBack = 0
    for (let i = 0; i < n && this.history.length > 0; i++) {
      if (this.rollback()) {
        rolledBack++
      }
    }
    console.log(`⏪ 回滚 ${rolledBack} 次变更`)
    return rolledBack
  }

  /**
   * 获取变更历史
   */
  getHistory(limit?: number): StateChange<T>[] {
    const history = [...this.history].reverse()
    return limit ? history.slice(0, limit) : history
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = []
    console.log('🗑️ 清空历史记录')
  }

  /**
   * 导出状态
   */
  export(): { state: Record<string, T>; snapshots: StateSnapshot<T>[] } {
    return {
      state: Object.fromEntries(this.state),
      snapshots: this.getSnapshots()
    }
  }

  /**
   * 导入状态
   */
  import(data: { state: Record<string, T>; snapshots?: StateSnapshot<T>[] }): void {
    // 创建当前状态快照
    this.createSnapshot('导入前自动备份', ['auto', 'import'])
    
    // 清空并导入
    this.state.clear()
    Object.entries(data.state).forEach(([key, value]) => {
      this.state.set(key, value)
    })
    
    if (data.snapshots) {
      data.snapshots.forEach(snapshot => {
        this.snapshots.set(snapshot.id, snapshot)
      })
    }
    
    console.log(`📥 导入状态: ${this.state.size} 条, ${this.snapshots.size} 个快照`)
  }

  /**
   * 销毁状态管理器
   */
  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
    }
    
    if (this.options.persistence === 'file') {
      this.saveToFile()
    }
  }

  // ============ 私有方法 ============

  private recordChange(change: StateChange<T>): void {
    this.history.push(change)
    
    // 限制历史记录数量
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift()
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getOldestSnapshotId(): string | undefined {
    let oldest: StateSnapshot<T> | undefined
    for (const snapshot of this.snapshots.values()) {
      if (!oldest || new Date(snapshot.timestamp) < new Date(oldest.timestamp)) {
        oldest = snapshot
      }
    }
    return oldest?.id
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.options.storagePath)) {
      fs.mkdirSync(this.options.storagePath, { recursive: true })
    }
  }

  private getStateFilePath(): string {
    return path.join(this.options.storagePath, 'state.json')
  }

  private getSnapshotsFilePath(): string {
    return path.join(this.options.storagePath, 'snapshots.json')
  }

  private loadFromFile(): void {
    try {
      // 加载状态
      const statePath = this.getStateFilePath()
      if (fs.existsSync(statePath)) {
        const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
        Object.entries(data).forEach(([key, value]) => {
          this.state.set(key, value as T)
        })
        console.log(`📂 加载状态: ${this.state.size} 条`)
      }
      
      // 加载快照
      const snapshotsPath = this.getSnapshotsFilePath()
      if (fs.existsSync(snapshotsPath)) {
        const snapshots = JSON.parse(fs.readFileSync(snapshotsPath, 'utf-8'))
        snapshots.forEach((snapshot: StateSnapshot<T>) => {
          this.snapshots.set(snapshot.id, snapshot)
        })
        console.log(`📂 加载快照: ${this.snapshots.size} 个`)
      }
    } catch (error) {
      console.error('❌ 加载状态文件失败:', error)
    }
  }

  private saveToFile(): void {
    try {
      // 保存状态
      const stateData = Object.fromEntries(this.state)
      fs.writeFileSync(
        this.getStateFilePath(),
        JSON.stringify(stateData, null, 2)
      )
      
      // 保存快照
      const snapshotsData = this.getSnapshots()
      fs.writeFileSync(
        this.getSnapshotsFilePath(),
        JSON.stringify(snapshotsData, null, 2)
      )
      
      console.log(`💾 保存状态: ${this.state.size} 条, ${this.snapshots.size} 个快照`)
    } catch (error) {
      console.error('❌ 保存状态文件失败:', error)
    }
  }

  private startAutoSave(): void {
    if (this.options.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.saveToFile()
      }, this.options.autoSaveInterval)
    }
  }
}

// ============ 导出任务状态机 ============

export { TaskStateMachine } from './task-state-machine'
export type {
  Task,
  FlowLogEntry,
  TransitionResult,
  Permission,
  TaskStateMachineOptions
} from './task-state-machine'
export { TaskState, AgentRole, STATE_TRANSITIONS, PERMISSION_MATRIX } from './task-state-machine'

// 默认导出
export default StateManager
