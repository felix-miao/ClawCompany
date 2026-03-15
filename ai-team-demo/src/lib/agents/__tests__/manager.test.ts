// Agent Manager 测试

import { AgentManager } from '../manager'

describe('AgentManager', () => {
  let manager: AgentManager

  beforeEach(() => {
    manager = new AgentManager()
  })

  it('应该初始化三个 Agent', () => {
    const agents = manager.getAllAgents()
    expect(agents).toHaveLength(3)
  })

  it('应该能获取 PM Agent', () => {
    const pmAgent = manager.getAgent('pm')
    expect(pmAgent).toBeDefined()
    expect(pmAgent?.name).toBe('PM Agent')
    expect(pmAgent?.role).toBe('pm')
  })

  it('应该能获取 Dev Agent', () => {
    const devAgent = manager.getAgent('dev')
    expect(devAgent).toBeDefined()
    expect(devAgent?.name).toBe('Dev Agent')
    expect(devAgent?.role).toBe('dev')
  })

  it('应该能获取 Review Agent', () => {
    const reviewAgent = manager.getAgent('review')
    expect(reviewAgent).toBeDefined()
    expect(reviewAgent?.name).toBe('Review Agent')
    expect(reviewAgent?.role).toBe('review')
  })

  it('应该返回所有 Agent 信息', () => {
    const info = manager.getAgentInfo()
    expect(info).toHaveLength(3)
    expect(info[0]).toHaveProperty('id')
    expect(info[0]).toHaveProperty('name')
    expect(info[0]).toHaveProperty('role')
    expect(info[0]).toHaveProperty('description')
  })
})
