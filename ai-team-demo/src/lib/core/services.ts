import { Container } from './container'
import { Logger } from './logger'
import { AgentManager } from '../agents/manager'
import { TaskManager } from '../tasks/manager'
import { ChatManager } from '../chat/manager'
import { Orchestrator, createOrchestrator } from '../orchestrator'
import { SandboxedFileWriter } from '../security/sandbox'
import { StorageManager } from '../storage/manager'
import { GitManager } from '../git/manager'
import { LLMFactory } from '../llm/factory'
import { OpenClawGatewayClient } from '../gateway/client'
import { OpenClawAgentExecutor } from '../gateway/executor'
import { GameEventStore } from '../../game/data/GameEventStore'
import type { LLMProvider } from '../llm/types'

export const Services = {
  Logger: Symbol('Logger'),
  AgentManager: Symbol('AgentManager'),
  TaskManager: Symbol('TaskManager'),
  ChatManager: Symbol('ChatManager'),
  Orchestrator: Symbol('Orchestrator'),
  SandboxedFileWriter: Symbol('SandboxedFileWriter'),
  StorageManager: Symbol('StorageManager'),
  GitManager: Symbol('GitManager'),
  LLMProvider: Symbol('LLMProvider'),
  GatewayClient: Symbol('GatewayClient'),
  AgentExecutor: Symbol('AgentExecutor'),
  GameEventStore: Symbol('GameEventStore'),
} as const

export type ServiceType = {
  [Services.Logger]: Logger
  [Services.AgentManager]: AgentManager
  [Services.TaskManager]: TaskManager
  [Services.ChatManager]: ChatManager
  [Services.Orchestrator]: Orchestrator
  [Services.SandboxedFileWriter]: SandboxedFileWriter
  [Services.StorageManager]: StorageManager
  [Services.GitManager]: GitManager
  [Services.LLMProvider]: LLMProvider | null
  [Services.GatewayClient]: OpenClawGatewayClient
  [Services.AgentExecutor]: OpenClawAgentExecutor
  [Services.GameEventStore]: GameEventStore
}

export function createAppContainer(rootDir?: string): Container {
  const container = new Container()
  const cwd = rootDir ?? process.cwd()

  container.register<Logger>(Services.Logger, () => new Logger())

  container.register<SandboxedFileWriter>(Services.SandboxedFileWriter, () => {
    return new SandboxedFileWriter(cwd)
  })

  container.register<StorageManager>(Services.StorageManager, () => {
    return new StorageManager()
  })

  container.register<GitManager>(Services.GitManager, () => {
    return new GitManager(cwd)
  })

  container.register<LLMProvider | null>(Services.LLMProvider, () => {
    return LLMFactory.createFromEnv()
  })

  container.register<ChatManager>(Services.ChatManager, () => {
    return new ChatManager()
  })

  container.register<TaskManager>(Services.TaskManager, () => {
    return new TaskManager()
  })

  container.register<AgentManager>(Services.AgentManager, () => {
    return new AgentManager()
  })

  container.register<OpenClawGatewayClient>(Services.GatewayClient, () => {
    const url = process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789'
    const token = process.env.OPENCLAW_GATEWAY_TOKEN
    return new OpenClawGatewayClient(url, { token })
  })

  container.register<OpenClawAgentExecutor>(Services.AgentExecutor, (c) => {
    const client = c.resolve<OpenClawGatewayClient>(Services.GatewayClient)
    return new OpenClawAgentExecutor(client)
  })

  container.register<GameEventStore>(Services.GameEventStore, () => {
    return new GameEventStore()
  })

  container.register<Orchestrator>(Services.Orchestrator, (c) => {
    return createOrchestrator({
      agentManager: c.resolve<AgentManager>(Services.AgentManager),
      taskManager: c.resolve<TaskManager>(Services.TaskManager),
      chatManager: c.resolve<ChatManager>(Services.ChatManager),
      sandboxedWriter: c.resolve<SandboxedFileWriter>(Services.SandboxedFileWriter),
    })
  })

  return container
}

let _defaultContainer: Container | null = null

export function getDefaultContainer(): Container {
  if (!_defaultContainer) {
    _defaultContainer = createAppContainer()
  }
  return _defaultContainer
}

export function resetDefaultContainer(): void {
  if (_defaultContainer) {
    _defaultContainer.resetAll()
    _defaultContainer = null
  }
}
