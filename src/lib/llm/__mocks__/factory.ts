// Auto-generated Jest manual mock for src/lib/llm/factory.ts
// Ensures all exports are available as jest.fn() stubs so tests that
// import from this module never hit real LLM providers.

import { LLMProvider } from '../types'

// ─── Mock LLMFactory class ────────────────────────────────────────────────────

export const LLMFactory = {
  createProvider: jest.fn().mockReturnValue(null),
  createFromEnv: jest.fn().mockReturnValue(null),
}

// ─── Module-level function mocks ─────────────────────────────────────────────

export const getLLMProvider = jest.fn<LLMProvider | null, []>().mockReturnValue(null)

export const setLLMProvider = jest.fn<void, [LLMProvider | null]>()

export const resetLLMProvider = jest.fn<void, []>()

export const getLLMProviderForAgent = jest.fn<LLMProvider | null, [string, string?]>().mockReturnValue(null)

export const logModelStrategyOnce = jest.fn<void, []>()

export const resetAgentProviderCache = jest.fn<void, []>()
