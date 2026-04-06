import { AgentRole, AgentRoleDefinition, DEFAULT_ROLE_DEFINITIONS } from '../types'

describe('AgentRoleDefinition', () => {
  describe('DEFAULT_ROLE_DEFINITIONS', () => {
    it('should have definitions for all agent roles', () => {
      const roles: AgentRole[] = ['pm', 'dev', 'review', 'tester']
      
      roles.forEach(role => {
        expect(DEFAULT_ROLE_DEFINITIONS[role]).toBeDefined()
        expect(DEFAULT_ROLE_DEFINITIONS[role].name).toBeDefined()
        expect(DEFAULT_ROLE_DEFINITIONS[role].profile).toBeDefined()
        expect(DEFAULT_ROLE_DEFINITIONS[role].goal).toBeDefined()
        expect(DEFAULT_ROLE_DEFINITIONS[role].capabilities).toBeDefined()
        expect(DEFAULT_ROLE_DEFINITIONS[role].capabilities.length).toBeGreaterThan(0)
      })
    })

    it('PM role should have correct profile', () => {
      const pm = DEFAULT_ROLE_DEFINITIONS['pm']
      
      expect(pm.name).toBe('PM Claw')
      expect(pm.profile).toContain('产品经理')
      expect(pm.goal).toContain('需求')
      expect(pm.capabilities).toContain('需求分析')
      expect(pm.constraints).toContain('不直接编写代码')
    })

    it('Dev role should have correct profile', () => {
      const dev = DEFAULT_ROLE_DEFINITIONS['dev']
      
      expect(dev.name).toBe('Dev Claw')
      expect(dev.profile).toContain('开发者')
      expect(dev.goal).toContain('代码')
      expect(dev.capabilities).toContain('前端开发')
      expect(dev.capabilities).toContain('后端开发')
    })

    it('Review role should have correct profile', () => {
      const review = DEFAULT_ROLE_DEFINITIONS['review']
      
      expect(review.name).toBe('Reviewer Claw')
      expect(review.profile).toContain('代码审查')
      expect(review.goal).toContain('代码质量')
      expect(review.capabilities).toContain('代码审查')
    })

    it('Tester role should have correct profile', () => {
      const tester = DEFAULT_ROLE_DEFINITIONS['tester']
      
      expect(tester.name).toBe('Tester Claw')
      expect(tester.profile).toContain('测试')
      expect(tester.goal).toContain('质量')
      expect(tester.capabilities).toContain('测试用例编写')
    })
  })

  describe('AgentRoleDefinition interface', () => {
    it('should allow creating custom role definitions', () => {
      const customRole: AgentRoleDefinition = {
        name: 'Custom Agent',
        profile: 'Custom description',
        goal: 'Custom goal',
        capabilities: ['capability1', 'capability2'],
        constraints: ['constraint1'],
      }

      expect(customRole.name).toBe('Custom Agent')
      expect(customRole.capabilities).toHaveLength(2)
      expect(customRole.constraints).toHaveLength(1)
    })

    it('should allow optional constraints', () => {
      const minimalRole: AgentRoleDefinition = {
        name: 'Minimal Agent',
        profile: 'Minimal description',
        goal: 'Minimal goal',
        capabilities: ['capability1'],
      }

      expect(minimalRole.constraints).toBeUndefined()
    })
  })
})
