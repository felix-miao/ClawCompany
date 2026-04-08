import { ConfigValidator, GameConfig, ValidationResult, AgentConfigInput } from '../ConfigValidator';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  const validAgentConfigs: AgentConfigInput[] = [
    { id: 'alice', name: 'Alice', role: 'Developer' },
    { id: 'bob', name: 'Bob', role: 'Developer' },
  ];

  const validConfig: GameConfig = {
    containerId: 'game-container',
    width: 800,
    height: 600,
    agents: validAgentConfigs,
  };

  describe('validate', () => {
    it('should pass valid config', () => {
      const result = validator.validate(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warnings for non-critical issues', () => {
      const config: GameConfig = {
        ...validConfig,
        width: 320,
        height: 240,
      };
      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('container validation', () => {
    it('should fail with empty containerId', () => {
      const result = validator.validate({ ...validConfig, containerId: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'containerId')).toBe(true);
    });

    it('should fail with missing containerId', () => {
      const result = validator.validate({ ...validConfig, containerId: undefined as any });
      expect(result.valid).toBe(false);
    });

    it('should warn if containerId has spaces', () => {
      const result = validator.validate({ ...validConfig, containerId: 'my game' });
      expect(result.warnings.some(w => w.field === 'containerId')).toBe(true);
    });
  });

  describe('dimension validation', () => {
    it('should fail with zero width', () => {
      const result = validator.validate({ ...validConfig, width: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'width')).toBe(true);
    });

    it('should fail with negative height', () => {
      const result = validator.validate({ ...validConfig, height: -100 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'height')).toBe(true);
    });

    it('should fail with non-number width', () => {
      const result = validator.validate({ ...validConfig, width: 'big' as any });
      expect(result.valid).toBe(false);
    });

    it('should warn when dimensions exceed 4096', () => {
      const result = validator.validate({ ...validConfig, width: 5000, height: 5000 });
      expect(result.warnings.some(w => w.field === 'width')).toBe(true);
    });

    it('should warn when width is less than 400', () => {
      const result = validator.validate({ ...validConfig, width: 300 });
      expect(result.warnings.some(w => w.field === 'width')).toBe(true);
    });

    it('should warn when aspect ratio is extreme', () => {
      const result = validator.validate({ ...validConfig, width: 2000, height: 100 });
      expect(result.warnings.some(w => w.field === 'dimensions')).toBe(true);
    });
  });

  describe('agent validation', () => {
    it('should fail with empty agents array', () => {
      const result = validator.validate({ ...validConfig, agents: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'agents')).toBe(true);
    });

    it('should fail with duplicate agent IDs', () => {
      const agents: AgentConfigInput[] = [
        { id: 'alice', name: 'Alice', role: 'Developer' },
        { id: 'alice', name: 'Alice 2', role: 'PM' },
      ];
      const result = validator.validate({ ...validConfig, agents });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'agents')).toBe(true);
    });

    it('should fail with agent missing id', () => {
      const agents = [{ name: 'Alice', role: 'Developer' }] as any;
      const result = validator.validate({ ...validConfig, agents });
      expect(result.valid).toBe(false);
    });

    it('should fail with agent missing name', () => {
      const agents = [{ id: 'alice', role: 'Developer' }] as any;
      const result = validator.validate({ ...validConfig, agents });
      expect(result.valid).toBe(false);
    });

    it('should fail with agent missing role', () => {
      const agents = [{ id: 'alice', name: 'Alice' }] as any;
      const result = validator.validate({ ...validConfig, agents });
      expect(result.valid).toBe(false);
    });

    it('should fail with agent ID containing special characters', () => {
      const agents: AgentConfigInput[] = [
        { id: 'ali@ce', name: 'Alice', role: 'Developer' },
      ];
      const result = validator.validate({ ...validConfig, agents });
      expect(result.valid).toBe(false);
    });

    it('should warn when more than 8 agents', () => {
      const agents: AgentConfigInput[] = Array.from({ length: 10 }, (_, i) => ({
        id: `agent-${i}`,
        name: `Agent ${i}`,
        role: 'Developer',
      }));
      const result = validator.validate({ ...validConfig, agents });
      expect(result.warnings.some(w => w.field === 'agents')).toBe(true);
    });

    it('should warn on duplicate agent names', () => {
      const agents: AgentConfigInput[] = [
        { id: 'alice', name: 'Agent', role: 'Developer' },
        { id: 'bob', name: 'Agent', role: 'PM' },
      ];
      const result = validator.validate({ ...validConfig, agents });
      expect(result.warnings.some(w => w.field === 'agents')).toBe(true);
    });
  });

  describe('physics config validation', () => {
    it('should pass with valid physics config', () => {
      const result = validator.validate({
        ...validConfig,
        physics: { gravity: 800, jumpForce: -400, moveSpeed: 200 },
      });
      expect(result.valid).toBe(true);
    });

    it('should warn on extreme gravity', () => {
      const result = validator.validate({
        ...validConfig,
        physics: { gravity: 5000 },
      });
      expect(result.warnings.some(w => w.field === 'physics.gravity')).toBe(true);
    });

    it('should warn on extreme moveSpeed', () => {
      const result = validator.validate({
        ...validConfig,
        physics: { moveSpeed: 2000 },
      });
      expect(result.warnings.some(w => w.field === 'physics.moveSpeed')).toBe(true);
    });

    it('should fail on negative gravity', () => {
      const result = validator.validate({
        ...validConfig,
        physics: { gravity: -100 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'physics.gravity')).toBe(true);
    });
  });

  describe('SSE config validation', () => {
    it('should pass with valid SSE URL', () => {
      const result = validator.validate({
        ...validConfig,
        sse: { url: '/api/game-events' },
      });
      expect(result.valid).toBe(true);
    });

    it('should warn on non-http SSE URL without leading slash', () => {
      const result = validator.validate({
        ...validConfig,
        sse: { url: 'game-events' },
      });
      expect(result.warnings.some(w => w.field === 'sse.url')).toBe(true);
    });

    it('should accept full HTTP URL', () => {
      const result = validator.validate({
        ...validConfig,
        sse: { url: 'http://localhost:3000/api/game-events' },
      });
      expect(result.valid).toBe(true);
    });

    it('should accept full HTTPS URL', () => {
      const result = validator.validate({
        ...validConfig,
        sse: { url: 'https://example.com/api/events' },
      });
      expect(result.valid).toBe(true);
    });

    it('should warn on SSE reconnect interval below 1000ms', () => {
      const result = validator.validate({
        ...validConfig,
        sse: { url: '/api/game-events', reconnectInterval: 500 },
      });
      expect(result.warnings.some(w => w.field === 'sse.reconnectInterval')).toBe(true);
    });
  });

  describe('validateAgent', () => {
    it('should validate a single agent config', () => {
      const result = validator.validateAgent({ id: 'alice', name: 'Alice', role: 'Developer' });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid agent config', () => {
      const result = validator.validateAgent({ id: '', name: '', role: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('addCustomRule', () => {
    it('should support custom validation rules', () => {
      validator.addCustomRule('no-bob', (config) => {
        const hasBob = config.agents?.some(a => a.id === 'bob');
        if (hasBob) {
          return { valid: false as const, errors: [{ field: 'agents', message: 'No bob allowed' }] };
        }
        return { valid: true as const };
      });

      const noBobConfig = { ...validConfig, agents: [{ id: 'alice', name: 'Alice', role: 'Developer' }] };
      const result = validator.validate(noBobConfig);
      expect(result.valid).toBe(true);

      const agentsWithBob: AgentConfigInput[] = [
        { id: 'bob', name: 'Bob', role: 'Developer' },
      ];
      const resultBob = validator.validate({ ...validConfig, agents: agentsWithBob });
      expect(resultBob.valid).toBe(false);
      expect(resultBob.errors.some(e => e.message === 'No bob allowed')).toBe(true);
    });

    it('should support custom warning rules', () => {
      validator.addCustomRule('large-team', (config) => {
        if ((config.agents?.length ?? 0) > 4) {
          return { valid: true as const, warnings: [{ field: 'agents', message: 'Large team may impact performance' }] };
        }
        return { valid: true as const };
      });

      const manyAgents: AgentConfigInput[] = Array.from({ length: 6 }, (_, i) => ({
        id: `agent-${i}`, name: `Agent ${i}`, role: 'Developer',
      }));
      const result = validator.validate({ ...validConfig, agents: manyAgents });
      expect(result.warnings.some(w => w.message === 'Large team may impact performance')).toBe(true);
    });
  });

  describe('error reporting', () => {
    it('should include field and message in each error', () => {
      const result = validator.validate({} as any);
      expect(result.valid).toBe(false);
      result.errors.forEach(err => {
        expect(err).toHaveProperty('field');
        expect(err).toHaveProperty('message');
        expect(typeof err.field).toBe('string');
        expect(typeof err.message).toBe('string');
      });
    });

    it('should include field and message in each warning', () => {
      const result = validator.validate({ ...validConfig, width: 200, height: 200 });
      result.warnings.forEach(warn => {
        expect(warn).toHaveProperty('field');
        expect(warn).toHaveProperty('message');
      });
    });

    it('should collect all errors not just the first', () => {
      const result = validator.validate({ containerId: '', width: -1, height: -1, agents: [] });
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getSchema', () => {
    it('should return the validation schema', () => {
      const schema = validator.getSchema();
      expect(schema).toHaveProperty('fields');
      expect(Array.isArray(schema.fields)).toBe(true);
      expect(schema.fields.length).toBeGreaterThan(0);
    });
  });
});
