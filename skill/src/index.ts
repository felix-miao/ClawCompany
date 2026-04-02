import { ClawCompanyOrchestrator } from './orchestrator'

export { ClawCompanyOrchestrator }
export type {
  Task,
  PMResult,
  DevResult,
  ReviewResult,
  ExecutionResult,
  OrchestratorConfig,
} from './core/types'

export async function createProject(
  userRequest: string,
  projectPath?: string,
) {
  const orchestrator = new ClawCompanyOrchestrator()
  return await orchestrator.execute(userRequest, projectPath)
}

export default {
  createProject,
  ClawCompanyOrchestrator,
}
