import { LLMFactory, getLLMProvider, setLLMProvider } from '../factory'
import { OpenAIProvider } from '../openai'
import { GLMProvider } from '../glm'
import { MockProvider } from '../mock'
import { GatewayProvider } from '../gateway'

jest.mock('../openai')
jest.mock('../glm')
jest.mock('../mock')
jest.mock('../gateway')

const MockedOpenAI = OpenAIProvider as jest.MockedClass<typeof OpenAIProvider>
const MockedGLM = GLMProvider as jest.MockedClass<typeof GLMProvider>
const MockedMock = MockProvider as jest.MockedClass<typeof MockProvider>
const MockedGateway = GatewayProvider as jest.MockedClass<typeof GatewayProvider>

describe('LLMFactory', () => {
  describe('createProvider', () => {
    it('should create OpenAIProvider for openai config', () => {
      const config = { provider: 'openai' as const, apiKey: 'test-key' }
      const provider = LLMFactory.createProvider(config)

      expect(MockedOpenAI).toHaveBeenCalledWith(config)
      expect(provider).toBeInstanceOf(OpenAIProvider)
    })

    it('should create GLMProvider for glm config', () => {
      const config = { provider: 'glm' as const, apiKey: 'test-key' }
      const provider = LLMFactory.createProvider(config)

      expect(MockedGLM).toHaveBeenCalledWith(config)
      expect(provider).toBeInstanceOf(GLMProvider)
    })

    it('should throw for anthropic (not implemented)', () => {
      const config = { provider: 'anthropic' as const, apiKey: 'test-key' }

      expect(() => LLMFactory.createProvider(config)).toThrow(
        'Anthropic provider not implemented yet'
      )
    })

    it('should throw for unknown provider', () => {
      const config = { provider: 'unknown' as any, apiKey: 'test-key' }

      expect(() => LLMFactory.createProvider(config)).toThrow(
        'Unknown LLM provider: unknown'
      )
    })

    it('should pass full config including optional fields to provider', () => {
      const config = {
        provider: 'openai' as const,
        apiKey: 'test-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 1000,
        timeout: 5000,
      }

      LLMFactory.createProvider(config)

      expect(MockedOpenAI).toHaveBeenCalledWith(config)
    })
  })

  describe('createFromEnv', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
      jest.spyOn(console, 'log').mockImplementation()
      jest.spyOn(console, 'warn').mockImplementation()
    })

    afterEach(() => {
      process.env = originalEnv
      jest.restoreAllMocks()
    })

    function setEnv(vars: Record<string, string | undefined>) {
      const keysToRemove = [
        'USE_REAL_GATEWAY',
        'USE_MOCK_LLM',
        'GLM_API_KEY',
        'OPENAI_API_KEY',
        'GLM_MODEL',
        'LLM_PROVIDER',
        'LLM_MODEL',
        'LLM_TEMPERATURE',
        'LLM_MAX_TOKENS',
      ]
      for (const key of keysToRemove) {
        delete process.env[key]
      }
      for (const [key, val] of Object.entries(vars)) {
        if (val !== undefined) {
          process.env[key] = val
        }
      }
    }

    it('should return GatewayProvider when USE_REAL_GATEWAY is true', () => {
      setEnv({ USE_REAL_GATEWAY: 'true' })

      const provider = LLMFactory.createFromEnv()

      expect(MockedGateway).toHaveBeenCalled()
      expect(provider).toBeInstanceOf(GatewayProvider)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Gateway Provider')
      )
    })

    it('should return MockProvider when USE_MOCK_LLM is true', () => {
      setEnv({ USE_MOCK_LLM: 'true' })

      const provider = LLMFactory.createFromEnv()

      expect(MockedMock).toHaveBeenCalled()
      expect(provider).toBeInstanceOf(MockProvider)
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Mock Provider')
      )
    })

    it('should prioritize Gateway over Mock when both are set', () => {
      setEnv({ USE_REAL_GATEWAY: 'true', USE_MOCK_LLM: 'true' })

      const provider = LLMFactory.createFromEnv()

      expect(provider).toBeInstanceOf(GatewayProvider)
    })

    it('should create GLMProvider when GLM_API_KEY is set', () => {
      setEnv({ GLM_API_KEY: 'glm-test-key' })

      const provider = LLMFactory.createFromEnv()

      expect(MockedGLM).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'glm',
          apiKey: 'glm-test-key',
          model: 'glm-4',
          temperature: 0.7,
          maxTokens: 2000,
        })
      )
      expect(provider).toBeInstanceOf(GLMProvider)
    })

    it('should use GLM_MODEL env var when set', () => {
      setEnv({ GLM_API_KEY: 'glm-test-key', GLM_MODEL: 'glm-3-turbo' })

      LLMFactory.createFromEnv()

      expect(MockedGLM).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'glm-3-turbo',
        })
      )
    })

    it('should use LLM_TEMPERATURE and LLM_MAX_TOKENS for GLM', () => {
      setEnv({
        GLM_API_KEY: 'glm-test-key',
        LLM_TEMPERATURE: '0.3',
        LLM_MAX_TOKENS: '4000',
      })

      LLMFactory.createFromEnv()

      expect(MockedGLM).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxTokens: 4000,
        })
      )
    })

    it('should prioritize GLM over OpenAI when both keys are set', () => {
      setEnv({ GLM_API_KEY: 'glm-key', OPENAI_API_KEY: 'openai-key' })

      const provider = LLMFactory.createFromEnv()

      expect(provider).toBeInstanceOf(GLMProvider)
    })

    it('should create OpenAIProvider when only OPENAI_API_KEY is set', () => {
      setEnv({ OPENAI_API_KEY: 'openai-test-key' })

      const provider = LLMFactory.createFromEnv()

      expect(MockedOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'openai-test-key',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 2000,
        })
      )
      expect(provider).toBeInstanceOf(OpenAIProvider)
    })

    it('should use LLM_PROVIDER env var to override provider type', () => {
      setEnv({
        OPENAI_API_KEY: 'openai-test-key',
        LLM_PROVIDER: 'openai',
      })

      LLMFactory.createFromEnv()

      expect(MockedOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
        })
      )
    })

    it('should use LLM_MODEL env var to override model for OpenAI', () => {
      setEnv({
        OPENAI_API_KEY: 'openai-test-key',
        LLM_MODEL: 'gpt-4-turbo',
      })

      LLMFactory.createFromEnv()

      expect(MockedOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
        })
      )
    })

    it('should use LLM_TEMPERATURE and LLM_MAX_TOKENS for OpenAI', () => {
      setEnv({
        OPENAI_API_KEY: 'openai-test-key',
        LLM_TEMPERATURE: '0.9',
        LLM_MAX_TOKENS: '8000',
      })

      LLMFactory.createFromEnv()

      expect(MockedOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.9,
          maxTokens: 8000,
        })
      )
    })

    it('should return null when no API keys are configured', () => {
      setEnv({})

      const provider = LLMFactory.createFromEnv()

      expect(provider).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('No LLM API key')
      )
    })

    it('should prioritize env vars in order: Gateway > Mock > GLM > OpenAI', () => {
      setEnv({
        USE_REAL_GATEWAY: 'true',
        USE_MOCK_LLM: 'true',
        GLM_API_KEY: 'glm-key',
        OPENAI_API_KEY: 'openai-key',
      })

      expect(LLMFactory.createFromEnv()).toBeInstanceOf(GatewayProvider)

      setEnv({ USE_MOCK_LLM: 'true', GLM_API_KEY: 'glm-key', OPENAI_API_KEY: 'openai-key' })
      expect(LLMFactory.createFromEnv()).toBeInstanceOf(MockProvider)

      setEnv({ GLM_API_KEY: 'glm-key', OPENAI_API_KEY: 'openai-key' })
      expect(LLMFactory.createFromEnv()).toBeInstanceOf(GLMProvider)

      setEnv({ OPENAI_API_KEY: 'openai-key' })
      expect(LLMFactory.createFromEnv()).toBeInstanceOf(OpenAIProvider)
    })
  })
})

describe('getLLMProvider / setLLMProvider', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('should return null initially when no provider is set and no env keys', () => {
    delete process.env.USE_REAL_GATEWAY
    delete process.env.USE_MOCK_LLM
    delete process.env.GLM_API_KEY
    delete process.env.OPENAI_API_KEY

    const result = getLLMProvider()
    expect(result).toBeNull()
  })

  it('should return the same provider instance on repeated calls (singleton)', () => {
    const mockProvider = { chat: jest.fn() }
    setLLMProvider(mockProvider as any)

    const first = getLLMProvider()
    const second = getLLMProvider()

    expect(first).toBe(second)
    expect(first).toBe(mockProvider)
  })

  it('should allow overriding the provider via setLLMProvider', () => {
    const provider1 = { chat: jest.fn() }
    const provider2 = { chat: jest.fn() }

    setLLMProvider(provider1 as any)
    expect(getLLMProvider()).toBe(provider1)

    setLLMProvider(provider2 as any)
    expect(getLLMProvider()).toBe(provider2)
  })

  it('should lazily initialize provider from env when not explicitly set', () => {
    process.env.OPENAI_API_KEY = 'lazy-init-key'
    jest.doMock('../openai', () => ({
      OpenAIProvider: jest.fn().mockImplementation(() => ({ chat: jest.fn() })),
    }))

    const provider = getLLMProvider()
    expect(provider).not.toBeNull()
  })
})
