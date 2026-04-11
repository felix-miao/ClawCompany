/**
 * Hybrid Model Strategy for ClawCompany
 *
 * Cost optimization: PM + Reviewer default to Haiku (~55% cheaper per token).
 * Dev always uses Sonnet (code generation quality is non-negotiable).
 * DA + Arbiter default to Sonnet (deep adversarial reasoning required).
 *
 * Per-agent model overrides via environment variables:
 *   CLAWCOMPANY_PM_MODEL       — default: claude-3-5-haiku-20241022
 *   CLAWCOMPANY_DEV_MODEL      — default: claude-3-5-sonnet-20241022 (override cautiously)
 *   CLAWCOMPANY_REVIEWER_MODEL — default: claude-3-5-haiku-20241022
 *   CLAWCOMPANY_DA_MODEL       — default: claude-3-5-sonnet-20241022
 *   CLAWCOMPANY_ARBITER_MODEL  — default: claude-3-5-sonnet-20241022
 *
 * Task complexity escalation (PM only):
 *   Simple  (< 50 chars AND no complexity keywords) → keeps Haiku
 *   Complex (has security/performance/architecture keywords) → escalates to Sonnet
 *
 * MoA Temperature Differentiation (per agent role):
 *   pm / dev          → 0.7  (Proposer: high diversity, creative output)
 *   review            → 0.6  (Critic: analytical, slightly lower entropy)
 *   devil-advocate    → 0.8  (DA: maximum contrarianism enforced)
 *   arbiter           → 0.3  (Arbiter: low temperature for consistent verdicts)
 *
 *   Override via LLM_TEMPERATURE env var (applies globally to all roles).
 */

export const CLAUDE_HAIKU = 'claude-3-5-haiku-20241022'
export const CLAUDE_SONNET = 'claude-3-5-sonnet-20241022'

export type AgentModelRole = 'pm' | 'dev' | 'review' | 'devil-advocate' | 'arbiter'

// ─── Env var names ──────────────────────────────────────────────────────────

const MODEL_ENV_MAP: Record<AgentModelRole, string> = {
  pm: 'CLAWCOMPANY_PM_MODEL',
  dev: 'CLAWCOMPANY_DEV_MODEL',
  review: 'CLAWCOMPANY_REVIEWER_MODEL',
  'devil-advocate': 'CLAWCOMPANY_DA_MODEL',
  arbiter: 'CLAWCOMPANY_ARBITER_MODEL',
}

// ─── Per-role defaults ──────────────────────────────────────────────────────

const MODEL_DEFAULTS: Record<AgentModelRole, string> = {
  pm: CLAUDE_HAIKU,     // task planning — Haiku handles well
  dev: CLAUDE_SONNET,   // code generation — quality critical
  review: CLAUDE_HAIKU, // code review — Haiku handles well
  'devil-advocate': CLAUDE_SONNET, // adversarial reasoning — needs depth
  arbiter: CLAUDE_SONNET,          // final verdict — needs depth
}

// ─── Per-role temperature defaults (MoA differentiation) ──────────────────

/**
 * Default temperatures per agent role following MoA theory:
 *   - Proposers (pm, dev) get 0.7 for creative diversity
 *   - Critic (review) gets 0.6 for analytical but slightly varied output
 *   - Devil's Advocate gets 0.8 — highest entropy to force contrarianism
 *   - Arbiter gets 0.3 — low temperature for consistent, decisive verdicts
 */
export const TEMPERATURE_DEFAULTS: Record<AgentModelRole, number> = {
  pm: 0.7,              // Proposer: high diversity
  dev: 0.7,             // Proposer: high diversity
  review: 0.6,          // Critic: analytical balance
  'devil-advocate': 0.8, // DA: max contrarianism
  arbiter: 0.3,          // Arbiter: consistency / determinism
}

/**
 * Return the temperature to use for a given agent role.
 *
 * If LLM_TEMPERATURE env var is set, it overrides all roles (backward compat).
 * Otherwise returns the MoA-tuned per-role default.
 */
export function getTemperatureForAgent(role: AgentModelRole): number {
  const envTemp = process.env.LLM_TEMPERATURE
  if (envTemp) return parseFloat(envTemp)
  return TEMPERATURE_DEFAULTS[role]
}

// ─── Complexity escalation keywords ────────────────────────────────────────

const COMPLEXITY_KEYWORDS = [
  // Chinese
  '安全', '性能', '架构', '迁移', '认证', '授权', '加密', '权限',
  '并发', '高可用', '分布式', '破坏性变更', '不可逆',
  // English
  'security', 'performance', 'architecture', 'migration', 'auth',
  'encrypt', 'permission', 'concurrency', 'high availability',
  'distributed', 'breaking change', 'irreversible',
]

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Assess task complexity.
 * Returns 'simple' for short tasks with no critical keywords,
 * 'complex' otherwise.
 */
export function assessTaskComplexity(taskDescription: string): 'simple' | 'complex' {
  const desc = taskDescription.toLowerCase()
  const hasComplexKeyword = COMPLEXITY_KEYWORDS.some(k => desc.includes(k.toLowerCase()))

  if (hasComplexKeyword) return 'complex'
  if (taskDescription.length >= 50) return 'complex'
  return 'simple'
}

/**
 * Return the model identifier to use for a given agent role.
 *
 * Priority order:
 *   1. Explicit env var override (CLAWCOMPANY_*_MODEL)
 *   2. Complexity-based escalation (PM only)
 *   3. Role default
 */
export function getModelForAgent(
  role: AgentModelRole,
  taskDescription?: string,
): string {
  const envKey = MODEL_ENV_MAP[role]
  const envModel = process.env[envKey]

  // Dev agent: env override is allowed but logged as a warning
  if (role === 'dev') {
    if (envModel && envModel !== CLAUDE_SONNET) {
      console.warn(
        `[ModelStrategy] ⚠️  Dev agent model overridden to "${envModel}" via ${envKey}. ` +
        `Code quality may be degraded. Recommended: ${CLAUDE_SONNET}`,
      )
      return envModel
    }
    return CLAUDE_SONNET
  }

  // Explicit env override for all other roles
  if (envModel) return envModel

  // PM: escalate to Sonnet when task is complex
  if (role === 'pm' && taskDescription) {
    const complexity = assessTaskComplexity(taskDescription)
    if (complexity === 'complex') {
      console.log(
        `[ModelStrategy] PM task complexity=complex → upgrading ${CLAUDE_HAIKU} → ${CLAUDE_SONNET}`,
      )
      return CLAUDE_SONNET
    }
  }

  return MODEL_DEFAULTS[role]
}

/**
 * Human-readable summary of the current strategy configuration.
 * Useful for startup logs / diagnostics.
 */
export function describeModelStrategy(): string {
  const lines = (Object.keys(MODEL_DEFAULTS) as AgentModelRole[]).map(role => {
    const envKey = MODEL_ENV_MAP[role]
    const effective = process.env[envKey] ?? MODEL_DEFAULTS[role]
    const source = process.env[envKey] ? `(env: ${envKey})` : '(default)'
    return `  ${role.padEnd(16)} → ${effective} ${source}`
  })
  return `[ModelStrategy] Hybrid model configuration:\n${lines.join('\n')}`
}
