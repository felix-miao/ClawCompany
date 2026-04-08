export interface AgentConfigInput {
  id: string;
  name: string;
  role: string;
}

export interface PhysicsConfigInput {
  gravity?: number;
  jumpForce?: number;
  moveSpeed?: number;
  maxVelocity?: number;
  drag?: number;
}

export interface SSEConfigInput {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface GameConfig {
  containerId: string;
  width: number;
  height: number;
  agents: AgentConfigInput[];
  physics?: PhysicsConfigInput;
  sse?: SSEConfigInput;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface CustomRuleResult {
  valid: boolean;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

export type CustomRule = (config: GameConfig) => CustomRuleResult;

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ValidationSchema {
  fields: SchemaField[];
}

const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class ConfigValidator {
  private customRules: Map<string, CustomRule> = new Map();

  validate(config: GameConfig): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    this.validateContainer(config, errors, warnings);
    this.validateDimensions(config, errors, warnings);
    this.validateAgents(config, errors, warnings);
    this.validatePhysics(config, errors, warnings);
    this.validateSSE(config, errors, warnings);
    this.runCustomRules(config, errors, warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  validateAgent(agent: AgentConfigInput): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    if (!agent.id) {
      errors.push({ field: 'id', message: 'Agent ID is required' });
    } else if (!VALID_ID_PATTERN.test(agent.id)) {
      errors.push({ field: 'id', message: `Agent ID "${agent.id}" contains invalid characters. Use only alphanumeric, hyphens, underscores` });
    }

    if (!agent.name) {
      errors.push({ field: 'name', message: 'Agent name is required' });
    }

    if (!agent.role) {
      errors.push({ field: 'role', message: 'Agent role is required' });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  addCustomRule(name: string, rule: CustomRule): void {
    this.customRules.set(name, rule);
  }

  removeCustomRule(name: string): void {
    this.customRules.delete(name);
  }

  getSchema(): ValidationSchema {
    return {
      fields: [
        { name: 'containerId', type: 'string', required: true, description: 'DOM element ID for the game container' },
        { name: 'width', type: 'number', required: true, description: 'Game canvas width in pixels' },
        { name: 'height', type: 'number', required: true, description: 'Game canvas height in pixels' },
        { name: 'agents', type: 'AgentConfigInput[]', required: true, description: 'Array of agent configurations' },
        { name: 'physics', type: 'PhysicsConfigInput', required: false, description: 'Physics simulation parameters' },
        { name: 'sse', type: 'SSEConfigInput', required: false, description: 'Server-Sent Events configuration' },
      ],
    };
  }

  private validateContainer(config: GameConfig, errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    if (!config.containerId) {
      errors.push({ field: 'containerId', message: 'Container ID is required' });
      return;
    }
    if (typeof config.containerId !== 'string') {
      errors.push({ field: 'containerId', message: 'Container ID must be a string' });
      return;
    }
    if (config.containerId.includes(' ')) {
      warnings.push({ field: 'containerId', message: 'Container ID contains spaces, which may cause DOM selection issues' });
    }
  }

  private validateDimensions(config: GameConfig, errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    if (typeof config.width !== 'number' || isNaN(config.width)) {
      errors.push({ field: 'width', message: 'Width must be a number' });
    } else if (config.width <= 0) {
      errors.push({ field: 'width', message: 'Width must be greater than 0' });
    } else {
      if (config.width < 400) {
        warnings.push({ field: 'width', message: `Width ${config.width}px is very small, minimum recommended is 400px` });
      }
      if (config.width > 4096) {
        warnings.push({ field: 'width', message: `Width ${config.width}px is very large, may cause performance issues` });
      }
    }

    if (typeof config.height !== 'number' || isNaN(config.height)) {
      errors.push({ field: 'height', message: 'Height must be a number' });
    } else if (config.height <= 0) {
      errors.push({ field: 'height', message: 'Height must be greater than 0' });
    } else {
      if (config.height < 300) {
        warnings.push({ field: 'height', message: `Height ${config.height}px is very small, minimum recommended is 300px` });
      }
      if (config.height > 4096) {
        warnings.push({ field: 'height', message: `Height ${config.height}px is very large, may cause performance issues` });
      }
    }

    if (
      typeof config.width === 'number' && !isNaN(config.width) && config.width > 0 &&
      typeof config.height === 'number' && !isNaN(config.height) && config.height > 0
    ) {
      const ratio = config.width / config.height;
      if (ratio > 5 || ratio < 0.2) {
        warnings.push({ field: 'dimensions', message: `Extreme aspect ratio (${ratio.toFixed(1)}:1), may cause layout issues` });
      }
    }
  }

  private validateAgents(config: GameConfig, errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    if (!config.agents || !Array.isArray(config.agents)) {
      errors.push({ field: 'agents', message: 'Agents must be an array' });
      return;
    }

    if (config.agents.length === 0) {
      errors.push({ field: 'agents', message: 'At least one agent is required' });
      return;
    }

    const ids = new Set<string>();
    const names = new Set<string>();
    let duplicateNames = false;

    for (const agent of config.agents) {
      const agentResult = this.validateAgent(agent);
      errors.push(...agentResult.errors);

      if (ids.has(agent.id)) {
        errors.push({ field: 'agents', message: `Duplicate agent ID: "${agent.id}"` });
      }
      ids.add(agent.id);

      if (names.has(agent.name)) {
        duplicateNames = true;
      }
      names.add(agent.name);
    }

    if (duplicateNames) {
      warnings.push({ field: 'agents', message: 'Duplicate agent names found, this may be confusing' });
    }

    if (config.agents.length > 8) {
      warnings.push({ field: 'agents', message: `${config.agents.length} agents may impact performance, recommended maximum is 8` });
    }
  }

  private validatePhysics(config: GameConfig, errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    if (!config.physics) return;

    if (config.physics.gravity !== undefined) {
      if (config.physics.gravity < 0) {
        errors.push({ field: 'physics.gravity', message: 'Gravity must be non-negative' });
      } else if (config.physics.gravity > 3000) {
        warnings.push({ field: 'physics.gravity', message: `Gravity ${config.physics.gravity} is very high, may cause unrealistic physics` });
      }
    }

    if (config.physics.moveSpeed !== undefined) {
      if (config.physics.moveSpeed < 0) {
        errors.push({ field: 'physics.moveSpeed', message: 'Move speed must be non-negative' });
      } else if (config.physics.moveSpeed > 1000) {
        warnings.push({ field: 'physics.moveSpeed', message: `Move speed ${config.physics.moveSpeed} is very high, agents will move extremely fast` });
      }
    }

    if (config.physics.jumpForce !== undefined && config.physics.jumpForce > 0) {
      warnings.push({ field: 'physics.jumpForce', message: 'Jump force is usually negative (upward). Positive values will push down' });
    }
  }

  private validateSSE(config: GameConfig, errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    if (!config.sse) return;

    if (config.sse.url) {
      const isAbsolute = config.sse.url.startsWith('http://') || config.sse.url.startsWith('https://');
      const isRelative = config.sse.url.startsWith('/');
      if (!isAbsolute && !isRelative) {
        warnings.push({ field: 'sse.url', message: 'SSE URL should start with "/" or "http(s)://"' });
      }
    }

    if (config.sse.reconnectInterval !== undefined && config.sse.reconnectInterval < 1000) {
      warnings.push({ field: 'sse.reconnectInterval', message: 'Reconnect interval below 1000ms may cause excessive reconnection attempts' });
    }
  }

  private runCustomRules(config: GameConfig, errors: ValidationIssue[], warnings: ValidationIssue[]): void {
    for (const [, rule] of this.customRules) {
      const result = rule(config);
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    }
  }
}
