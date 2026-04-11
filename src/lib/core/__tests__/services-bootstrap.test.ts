import { Container, ScopedContainer } from '../container'
import { 
  Services, 
  ServiceType, 
  createAppContainer, 
  getDefaultContainer, 
  resetDefaultContainer 
} from '../services'
import { Logger } from '../logger'
import { AgentManager } from '../../agents/manager'
import { TaskManager } from '../../tasks/manager'
import { ChatManager } from '../../chat/manager'
import { Orchestrator } from '../../orchestrator'
import { SandboxedFileWriter } from '../../security/sandbox'
import { StorageManager } from '../../storage/manager'
import { GitManager } from '../../git/manager'
import { LLMFactory } from '../../llm/factory'
import { OpenClawGatewayClient } from '../../gateway/client'
import { OpenClawAgentExecutor } from '../../gateway/executor'
import { GameEventStore } from '../../../game/data/GameEventStore'
import type { LLMProvider } from '../../llm/types'

describe('Services Bootstrap', () => {
  let container: Container

  beforeEach(() => {
    resetDefaultContainer()
    container = createAppContainer('/test/path')
  })

  afterEach(() => {
    resetDefaultContainer()
  })

  describe('createAppContainer', () => {
    it('应该创建包含所有必要服务的容器', () => {
      expect(container).toBeInstanceOf(Container)
      expect(container.has(Services.Logger)).toBe(true)
      expect(container.has(Services.AgentManager)).toBe(true)
      expect(container.has(Services.TaskManager)).toBe(true)
      expect(container.has(Services.ChatManager)).toBe(true)
      expect(container.has(Services.Orchestrator)).toBe(true)
      expect(container.has(Services.SandboxedFileWriter)).toBe(true)
      expect(container.has(Services.StorageManager)).toBe(true)
      expect(container.has(Services.GitManager)).toBe(true)
      expect(container.has(Services.LLMProvider)).toBe(true)
      expect(container.has(Services.GatewayClient)).toBe(true)
      expect(container.has(Services.AgentExecutor)).toBe(true)
      expect(container.has(Services.GameEventStore)).toBe(true)
    })

    it('应该注入正确的根目录', () => {
      const containerWithPath = createAppContainer('/custom/path')
      expect(container).not.toBe(containerWithPath)
    })

    it('默认使用当前工作目录', () => {
      const defaultContainer = createAppContainer()
      expect(defaultContainer).toBeInstanceOf(Container)
    })

    it('所有服务都应该正确实例化', () => {
      const logger = container.resolve<Logger>(Services.Logger)
      const agentManager = container.resolve<AgentManager>(Services.AgentManager)
      const taskManager = container.resolve<TaskManager>(Services.TaskManager)
      const chatManager = container.resolve<ChatManager>(Services.ChatManager)
      const orchestrator = container.resolve<Orchestrator>(Services.Orchestrator)
      const sandboxedWriter = container.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter)
      const storageManager = container.resolve<StorageManager>(Services.StorageManager)
      const gitManager = container.resolve<GitManager>(Services.GitManager)
      const llmProvider = container.resolve<LLMProvider | null>(Services.LLMProvider)
      const gatewayClient = container.resolve<OpenClawGatewayClient>(Services.GatewayClient)
      const agentExecutor = container.resolve<OpenClawAgentExecutor>(Services.AgentExecutor)
      const gameEventStore = container.resolve<GameEventStore>(Services.GameEventStore)

      expect(logger).toBeInstanceOf(Logger)
      expect(agentManager).toBeInstanceOf(AgentManager)
      expect(taskManager).toBeInstanceOf(TaskManager)
      expect(chatManager).toBeInstanceOf(ChatManager)
      expect(orchestrator).toBeInstanceOf(Orchestrator)
      expect(sandboxedWriter).toBeInstanceOf(SandboxedFileWriter)
      expect(storageManager).toBeInstanceOf(StorageManager)
      expect(gitManager).toBeInstanceOf(GitManager)
      expect(llmProvider).toBeNull() // 从环境变量创建，测试环境可能为 null
      expect(gatewayClient).toBeInstanceOf(OpenClawGatewayClient)
      expect(agentExecutor).toBeInstanceOf(OpenClawAgentExecutor)
      expect(gameEventStore).toBeInstanceOf(GameEventStore)
    })

    it('所有服务都应该是单例', () => {
      const logger1 = container.resolve<Logger>(Services.Logger)
      const logger2 = container.resolve<Logger>(Services.Logger)
      expect(logger1).toBe(logger2)

      const agentManager1 = container.resolve<AgentManager>(Services.AgentManager)
      const agentManager2 = container.resolve<AgentManager>(Services.AgentManager)
      expect(agentManager1).toBe(agentManager2)

      const orchestrator1 = container.resolve<Orchestrator>(Services.Orchestrator)
      const orchestrator2 = container.resolve<Orchestrator>(Services.Orchestrator)
      expect(orchestrator1).toBe(orchestrator2)
    })
  })

  describe('依赖注入验证', () => {
    it('AgentManager 应该正确注入依赖', () => {
      const agentManager = container.resolve<AgentManager>(Services.AgentManager)
      
      // AgentManager 应该有正确的方法
      expect(typeof agentManager.getAgent).toBe('function')
      expect(typeof agentManager.getAllAgents).toBe('function')
      expect(typeof agentManager.executeAgent).toBe('function')
      expect(typeof agentManager.getAgentInfo).toBe('function')
    })

    it('TaskManager 应该正确注入依赖', () => {
      const taskManager = container.resolve<TaskManager>(Services.TaskManager)
      
      expect(typeof taskManager.createTask).toBe('function')
      expect(typeof taskManager.getTask).toBe('function')
      expect(typeof taskManager.getAllTasks).toBe('function')
      expect(typeof taskManager.updateTaskStatus).toBe('function')
      expect(typeof taskManager.getTasksByStatus).toBe('function')
      expect(typeof taskManager.getTasksByAgent).toBe('function')
    })

    it('Orchestrator 应该正确注入所有必需依赖', () => {
      const orchestrator = container.resolve<Orchestrator>(Services.Orchestrator)
      
      expect(typeof orchestrator.executeUserRequest).toBe('function')
      expect(typeof orchestrator.getStatus).toBe('function')
      expect(typeof orchestrator.abortWorkflow).toBe('function')
      expect(typeof orchestrator.getTaskQueueStats).toBe('function')
    })

    it('OpenClawAgentExecutor 应该正确注入 GatewayClient', () => {
      const gatewayClient = container.resolve<OpenClawGatewayClient>(Services.GatewayClient)
      const agentExecutor = container.resolve<OpenClawAgentExecutor>(Services.AgentExecutor)
      
      // AgentExecutor 应该使用注入的 client
      expect((agentExecutor as any).client).toBe(gatewayClient)
    })
  })

  describe('默认容器管理', () => {
    it('getDefaultContainer 应该返回同一个实例', () => {
      const container1 = getDefaultContainer()
      const container2 = getDefaultContainer()
      
      expect(container1).toBe(container2)
    })

    it('第一次调用 getDefaultContainer 应该创建容器', () => {
      resetDefaultContainer()
      const container = getDefaultContainer()
      
      expect(container).toBeInstanceOf(Container)
      expect(container.has(Services.Logger)).toBe(true)
    })

    it('resetDefaultContainer 应该清理默认容器', () => {
      const firstContainer = getDefaultContainer()
      resetDefaultContainer()
      const secondContainer = getDefaultContainer()
      
      expect(firstContainer).not.toBe(secondContainer)
    })

    it('resetDefaultContainer 后服务应该能重新创建', () => {
      const firstContainer = getDefaultContainer()
      const logger1 = firstContainer.resolve<Logger>(Services.Logger)
      
      resetDefaultContainer()
      const secondContainer = getDefaultContainer()
      const logger2 = secondContainer.resolve<Logger>(Services.Logger)
      
      expect(logger1).not.toBe(logger2)
    })
  })

  describe('服务配置和环境', () => {
    it('GatewayClient 应该使用默认 URL', () => {
      const gatewayClient = container.resolve<OpenClawGatewayClient>(Services.GatewayClient)
      
      expect((gatewayClient as any).url).toBe('ws://127.0.0.1:18789')
    })

    it('GatewayClient 应该支持从环境变量获取配置', () => {
      process.env.OPENCLAW_GATEWAY_URL = 'ws://custom:8080'
      process.env.OPENCLAW_GATEWAY_TOKEN = 'test-token'
      
      const newContainer = createAppContainer()
      const gatewayClient = newContainer.resolve<OpenClawGatewayClient>(Services.GatewayClient)
      
      expect((gatewayClient as any).url).toBe('ws://custom:8080')
      // GatewayClient 没有直接的 options.token 属性，但可以通过构造函数设置
      
      // 清理环境变量
      delete process.env.OPENCLAW_GATEWAY_URL
      delete process.env.OPENCLAW_GATEWAY_TOKEN
    })

    it('LLMProvider 应该从环境变量创建', () => {
      const llmProvider = container.resolve<LLMProvider | null>(Services.LLMProvider)
      
      expect(llmProvider).toBeNull() // 测试环境可能没有配置 LLM
    })

    it('SandboxedFileWriter 应该使用正确的工作目录', () => {
      const sandboxedWriter = container.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter)
      
      expect(sandboxedWriter.getSandboxDir()).toContain('/test/path')
    })
  })

  describe('容器隔离和作用域', () => {
    it('不同容器应该是独立的', () => {
      const container1 = createAppContainer('/path1')
      const container2 = createAppContainer('/path2')
      
      expect(container1).not.toBe(container2)
      
      const writer1 = container1.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter)
      const writer2 = container2.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter)
      
      expect(writer1).not.toBe(writer2)
    })

    it('容器之间应该不影响彼此的实例', () => {
      const container1 = createAppContainer('/path1')
      const container2 = createAppContainer('/path2')
      
      const writer1 = container1.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter)
      const writer2 = container2.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter)
      
      expect(writer1.getSandboxDir()).toContain('/path1')
      expect(writer2.getSandboxDir()).toContain('/path2')
    })

    it('创建作用域后服务配置', () => {
      const scope = container.createScope()
      
      // ScopedContainer 没有 has 方法，但可以通过解析测试
      expect(() => scope.resolve<Logger>(Services.Logger)).not.toThrow()
      expect(() => scope.resolve<AgentManager>(Services.AgentManager)).not.toThrow()
      
      // scope 应该能解析父容器的服务
      const logger = scope.resolve<Logger>(Services.Logger)
      expect(logger).toBeInstanceOf(Logger)
    })

    it('每个容器请求应该返回独立的 GameEventStore 实例', () => {
      const container1 = createAppContainer('/path1')
      const container2 = createAppContainer('/path2')

      const store1 = container1.resolve<GameEventStore>(Services.GameEventStore)
      const store2 = container2.resolve<GameEventStore>(Services.GameEventStore)

      expect(store1).not.toBe(store2)
    })

    it('每个容器请求应该返回独立的 GatewayClient 实例', () => {
      const container1 = createAppContainer('/path1')
      const container2 = createAppContainer('/path2')

      const client1 = container1.resolve<OpenClawGatewayClient>(Services.GatewayClient)
      const client2 = container2.resolve<OpenClawGatewayClient>(Services.GatewayClient)

      expect(client1).not.toBe(client2)
    })

    it('每个容器请求应该返回独立的 AgentExecutor 实例', () => {
      const container1 = createAppContainer('/path1')
      const container2 = createAppContainer('/path2')

      const executor1 = container1.resolve<OpenClawAgentExecutor>(Services.AgentExecutor)
      const executor2 = container2.resolve<OpenClawAgentExecutor>(Services.AgentExecutor)

      expect(executor1).not.toBe(executor2)
    })
  })

  describe('服务类型安全', () => {
    it('ServiceType 类型应该正确映射所有服务', () => {
      // 这个测试主要是验证 TypeScript 类型定义的正确性
      // 在运行时，我们主要关心服务是否能正确解析和实例化
      
      const services: Array<keyof typeof Services> = [
        'Logger',
        'AgentManager',
        'TaskManager', 
        'ChatManager',
        'Orchestrator',
        'SandboxedFileWriter',
        'StorageManager',
        'GitManager',
        'LLMProvider',
        'GatewayClient',
        'AgentExecutor',
        'GameEventStore'
      ]
      
      services.forEach(service => {
        expect(container.has(Services[service])).toBe(true)
      })
    })

    it('TypeScript 类型约束应该生效', () => {
      // 这是一个编译时测试，确保类型定义的正确性
      // 如果类型定义有问题，这里可能会出现编译错误
      
      const container = createAppContainer()
      
      // 这些应该都符合 ServiceType 类型
      const logger: ServiceType[typeof Services.Logger] = container.resolve(Services.Logger)
      const agentManager: ServiceType[typeof Services.AgentManager] = container.resolve(Services.AgentManager)
      const taskManager: ServiceType[typeof Services.TaskManager] = container.resolve(Services.TaskManager)
      
      expect(logger).toBeInstanceOf(Logger)
      expect(agentManager).toBeInstanceOf(AgentManager)
      expect(taskManager).toBeInstanceOf(TaskManager)
    })
  })

  describe('错误处理和边界情况', () => {
    it('未注册的服务应该抛出错误', () => {
      expect(() => {
        // @ts-ignore - 测试未注册的服务
        container.resolve('UnknownService')
      }).toThrow()
    })

    it('服务解析失败应该适当处理', () => {
      // LLMProvider 在测试环境中可能为 null，但不应该抛出错误
      expect(() => {
        container.resolve(Services.LLMProvider)
      }).not.toThrow()
    })

    it('容器重置不应该影响服务注册', () => {
      container.reset(Services.Logger)
      
      // 重置后服务仍然应该能够被解析
      const logger = container.resolve<Logger>(Services.Logger)
      expect(logger).toBeInstanceOf(Logger)
      
      // 重置后应该创建新的实例
      const logger2 = container.resolve<Logger>(Services.Logger)
      const logger1 = container.resolve<Logger>(Services.Logger)
      expect(logger1).toBe(logger2) // 单例应该还是同一个
    })
  })
})