/**
 * State Management Tests
 */

import { StateManager, StateSnapshot, StateChange } from '../src/state'

describe('StateManager', () => {
  let manager: StateManager<any>

  beforeEach(() => {
    manager = new StateManager({ persistence: 'memory' })
  })

  afterEach(() => {
    manager.destroy()
  })

  // ============ 基本操作 ============

  describe('基本操作', () => {
    test('应该能够设置和获取状态', () => {
      manager.set('key1', 'value1')
      expect(manager.get('key1')).toBe('value1')
    })

    test('应该能够检查状态是否存在', () => {
      manager.set('key1', 'value1')
      expect(manager.has('key1')).toBe(true)
      expect(manager.has('key2')).toBe(false)
    })

    test('应该能够删除状态', () => {
      manager.set('key1', 'value1')
      expect(manager.delete('key1')).toBe(true)
      expect(manager.has('key1')).toBe(false)
    })

    test('应该能够清空所有状态', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      manager.clear()
      expect(manager.keys().length).toBe(0)
    })

    test('应该能够获取所有键', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      const keys = manager.keys()
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
    })

    test('应该能够获取所有值', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      const values = manager.values()
      expect(values).toContain('value1')
      expect(values).toContain('value2')
    })

    test('应该能够获取所有条目', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      const entries = manager.entries()
      expect(entries).toContainEqual(['key1', 'value1'])
      expect(entries).toContainEqual(['key2', 'value2'])
    })
  })

  // ============ 快照功能 ============

  describe('快照功能', () => {
    test('应该能够创建快照', () => {
      manager.set('key1', 'value1')
      const snapshotId = manager.createSnapshot('测试快照', ['test'])
      expect(snapshotId).toBeTruthy()
      expect(manager.has(snapshotId)).toBe(false) // 快照 ID 不应该在状态中
    })

    test('应该能够获取所有快照', () => {
      manager.set('key1', 'value1')
      manager.createSnapshot('快照1')
      manager.set('key2', 'value2')
      manager.createSnapshot('快照2')
      
      const snapshots = manager.getSnapshots()
      expect(snapshots.length).toBe(2)
    })

    test('应该能够恢复到快照', () => {
      manager.set('key1', 'value1')
      const snapshotId = manager.createSnapshot('初始快照')
      
      manager.set('key1', 'value2')
      manager.set('key2', 'value3')
      
      expect(manager.get('key1')).toBe('value2')
      expect(manager.get('key2')).toBe('value3')
      
      const restored = manager.restoreSnapshot(snapshotId)
      expect(restored).toBe(true)
      
      expect(manager.get('key1')).toBe('value1')
      expect(manager.get('key2')).toBeUndefined()
    })

    test('恢复不存在的快照应该返回 false', () => {
      const restored = manager.restoreSnapshot('non-existent')
      expect(restored).toBe(false)
    })

    test('应该能够删除快照', () => {
      manager.set('key1', 'value1')
      const snapshotId = manager.createSnapshot('测试快照')
      
      expect(manager.getSnapshots().length).toBe(1)
      
      const deleted = manager.deleteSnapshot(snapshotId)
      expect(deleted).toBe(true)
      expect(manager.getSnapshots().length).toBe(0)
    })

    test('应该限制快照数量', () => {
      const smallManager = new StateManager({ 
        persistence: 'memory',
        maxSnapshots: 3 
      })
      
      for (let i = 0; i < 5; i++) {
        smallManager.set('key', `value${i}`)
        smallManager.createSnapshot(`快照${i}`)
      }
      
      expect(smallManager.getSnapshots().length).toBe(3)
      smallManager.destroy()
    })
  })

  // ============ 回滚功能 ============

  describe('回滚功能', () => {
    test('应该能够回滚 set 操作', () => {
      manager.set('key1', 'value1')
      manager.set('key1', 'value2')
      
      expect(manager.get('key1')).toBe('value2')
      
      manager.rollback()
      expect(manager.get('key1')).toBe('value1')
    })

    test('应该能够回滚 delete 操作', () => {
      manager.set('key1', 'value1')
      manager.delete('key1')
      
      expect(manager.has('key1')).toBe(false)
      
      manager.rollback()
      expect(manager.get('key1')).toBe('value1')
    })

    test('应该能够回滚 clear 操作', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      manager.clear()
      
      expect(manager.keys().length).toBe(0)
      
      manager.rollback()
      expect(manager.get('key1')).toBe('value1')
      expect(manager.get('key2')).toBe('value2')
    })

    test('应该能够回滚多次', () => {
      manager.set('key1', 'value1')
      manager.set('key1', 'value2')
      manager.set('key1', 'value3')
      
      expect(manager.get('key1')).toBe('value3')
      
      manager.rollbackN(2)
      expect(manager.get('key1')).toBe('value1')
    })

    test('没有历史记录时回滚应该返回 false', () => {
      const rolledBack = manager.rollback()
      expect(rolledBack).toBe(false)
    })

    test('应该能够获取变更历史', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      manager.delete('key1')
      
      const history = manager.getHistory()
      expect(history.length).toBe(3)
      expect(history[0].operation).toBe('delete')
      expect(history[1].operation).toBe('set')
      expect(history[2].operation).toBe('set')
    })

    test('应该能够清空历史记录', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      
      expect(manager.getHistory().length).toBe(2)
      
      manager.clearHistory()
      expect(manager.getHistory().length).toBe(0)
    })

    test('应该限制历史记录数量', () => {
      const smallManager = new StateManager({ 
        persistence: 'memory',
        maxHistorySize: 5 
      })
      
      for (let i = 0; i < 10; i++) {
        smallManager.set(`key${i}`, `value${i}`)
      }
      
      expect(smallManager.getHistory().length).toBe(5)
      smallManager.destroy()
    })
  })

  // ============ 导入导出 ============

  describe('导入导出', () => {
    test('应该能够导出状态', () => {
      manager.set('key1', 'value1')
      manager.set('key2', 'value2')
      manager.createSnapshot('测试快照')
      
      const exported = manager.export()
      expect(exported.state.key1).toBe('value1')
      expect(exported.state.key2).toBe('value2')
      expect(exported.snapshots.length).toBe(1)
    })

    test('应该能够导入状态', () => {
      const data = {
        state: {
          key1: 'value1',
          key2: 'value2'
        },
        snapshots: []
      }
      
      manager.import(data)
      
      expect(manager.get('key1')).toBe('value1')
      expect(manager.get('key2')).toBe('value2')
    })

    test('导入应该创建备份快照', () => {
      manager.set('key1', 'old_value')
      
      const data = {
        state: {
          key1: 'new_value'
        }
      }
      
      manager.import(data)
      
      // 应该有两个快照：导入前自动备份 + 导入前的原始状态
      expect(manager.getSnapshots().length).toBeGreaterThanOrEqual(1)
    })
  })

  // ============ 类型支持 ============

  describe('类型支持', () => {
    test('应该支持字符串类型', () => {
      const stringManager = new StateManager<string>()
      stringManager.set('key', 'value')
      expect(stringManager.get('key')).toBe('value')
      stringManager.destroy()
    })

    test('应该支持数字类型', () => {
      const numberManager = new StateManager<number>()
      numberManager.set('count', 42)
      expect(numberManager.get('count')).toBe(42)
      numberManager.destroy()
    })

    test('应该支持对象类型', () => {
      const objectManager = new StateManager<{ name: string; age: number }>()
      objectManager.set('user', { name: 'Alice', age: 30 })
      const user = objectManager.get('user')
      expect(user?.name).toBe('Alice')
      expect(user?.age).toBe(30)
      objectManager.destroy()
    })

    test('应该支持数组类型', () => {
      const arrayManager = new StateManager<number[]>()
      arrayManager.set('items', [1, 2, 3])
      expect(arrayManager.get('items')).toEqual([1, 2, 3])
      arrayManager.destroy()
    })
  })

  // ============ 边界情况 ============

  describe('边界情况', () => {
    test('获取不存在的键应该返回 undefined', () => {
      expect(manager.get('non-existent')).toBeUndefined()
    })

    test('删除不存在的键应该返回 false', () => {
      expect(manager.delete('non-existent')).toBe(false)
    })

    test('空状态应该返回空数组', () => {
      expect(manager.keys()).toEqual([])
      expect(manager.values()).toEqual([])
      expect(manager.entries()).toEqual([])
    })

    test('应该正确处理 undefined 值', () => {
      manager.set('key', undefined)
      expect(manager.has('key')).toBe(true)
      expect(manager.get('key')).toBeUndefined()
    })

    test('应该正确处理 null 值', () => {
      manager.set('key', null)
      expect(manager.has('key')).toBe(true)
      expect(manager.get('key')).toBeNull()
    })
  })
})
