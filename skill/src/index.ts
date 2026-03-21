/**
 * ClawCompany - AI 虚拟团队协作系统
 * 
 * 让一个人也能像拥有一支完整团队一样工作
 */

import { ClawCompanyOrchestrator } from './orchestrator'

// Orchestrator
export { ClawCompanyOrchestrator }
export type { 
  Task, 
  PMResult, 
  DevResult, 
  ReviewResult, 
  ExecutionResult,
  OrchestratorConfig 
} from './orchestrator'

// State Management
export { StateManager } from './state'
export type { 
  StateSnapshot, 
  StateChange, 
  StateManagerOptions 
} from './state'

// Workflow Engine
export { WorkflowEngine, WorkflowBuilder } from './workflow/engine'
export type { 
  Workflow, 
  WorkflowNode, 
  WorkflowContext, 
  WorkflowResult,
  TaskExecutor
} from './workflow/engine'

// Plugin System
export { PluginManager } from './plugins'
export type { 
  Plugin, 
  PluginMetadata, 
  PluginConfig,
  PluginContext,
  PluginAPI,
  PluginHooks,
  PluginManagerOptions
} from './plugins'

/**
 * 创建项目 - 便捷函数
 * 
 * @param userRequest 用户需求描述
 * @param projectPath 项目路径（可选）
 * @returns 执行结果
 * 
 * @example
 * const result = await createProject(
 *   "创建一个登录页面",
 *   "/path/to/project"
 * )
 * console.log(result.summary)
 */
export async function createProject(
  userRequest: string,
  projectPath?: string
) {
  const orchestrator = new ClawCompanyOrchestrator()
  return await orchestrator.execute(userRequest, projectPath)
}

/**
 * 默认导出
 */
export default {
  createProject,
  ClawCompanyOrchestrator
}
