/**
 * tool-aware-dev-agent.ts
 *
 * 演示如何在现有 DevAgent 基础上集成工具调用能力。
 * 这是一个 mixin 模式示例，不破坏现有 DevAgent 结构。
 */

import { Task, AgentContext, AgentResponse } from '../core/types'
import { DevAgent } from '../agents/dev-agent'
import { DefaultAgentToolRegistry } from './registry'
import { ExecTool, FileTool, FetchTool, GitTool } from './builtin-tools'
import { OpenClawBridgeTool, createOpenClawExecTool, createOpenClawSearchTool } from './openclaw-bridge'
import { runAgenticLoop, adaptLLMProviderToTools } from './agentic-loop'
import { AgentToolRegistry } from './types'
import { getGatewayClient } from '../gateway/client'
import { getLLMProvider } from '../llm/factory'

/**
 * 工具感知的 DevAgent 工厂
 * 根据运行环境自动选择工具集
 */
export function createToolAwareDevAgent(options?: {
  useOpenClawBridge?: boolean
  registryOverride?: AgentToolRegistry
}) {
  const devAgent = new DevAgent()
  const registry = options?.registryOverride ?? buildDefaultRegistry(options?.useOpenClawBridge)

  // 在 DevAgent 上挂载工具调用能力（不修改原始类）
  return {
    ...devAgent,
    toolRegistry: registry,

    /** 使用工具增强的 execute */
    async executeWithTools(task: Task, context: AgentContext): Promise<AgentResponse> {
      const llmProvider = getLLMProvider()
      if (!llmProvider) {
        // 无 LLM 时退回原始实现
        return devAgent.execute(task, context)
      }

      const toolAwareLLM = adaptLLMProviderToTools(llmProvider)

      const systemPrompt = buildSystemPromptWithTools(registry)
      const userPrompt = `
任务：${task.title}
描述：${task.description}
项目文件：${Object.keys(context.files).join(', ') || '（无）'}

请实现该任务，必要时调用工具查看文件内容或执行命令。
完成后以 JSON 格式返回修改的文件列表。
      `.trim()

      const result = await runAgenticLoop(
        toolAwareLLM,
        registry,
        systemPrompt,
        userPrompt,
        {
          maxRounds: 8,
          onBeforeToolCall: (call) => {
            console.log(`[ToolAwareDevAgent] Calling tool: ${call.name}`, call.arguments)
            return true
          },
        }
      )

      return {
        agent: 'dev',
        message: result.finalAnswer,
        status: 'success',
        metadata: {
          toolRounds: result.rounds,
          toolCallsExecuted: result.toolCallsExecuted,
        },
      }
    },
  }
}

function buildDefaultRegistry(useOpenClawBridge = false): AgentToolRegistry {
  const registry = new DefaultAgentToolRegistry()

  if (useOpenClawBridge || process.env.USE_OPENCLAW_GATEWAY === 'true') {
    // OpenClaw 宿主环境：使用 Bridge 工具（更高权限、完整审计）
    const client = getGatewayClient()
    registry.register(new OpenClawBridgeTool(client))
    registry.register(createOpenClawExecTool(client))
    registry.register(createOpenClawSearchTool(client))
    // 文件操作也走 OpenClaw（沙箱权限）
    registry.register({
      name: 'oc_file_read',
      description: '通过 OpenClaw 宿主读取项目文件',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '文件路径' } },
        required: ['path'],
      },
      async execute(input: Record<string, unknown>) {
        const bridge = new OpenClawBridgeTool(client)
        return bridge.execute({ tool: 'read', params: input })
      },
      formatResult(r) { return r.success ? String((r.data as { raw: unknown })?.raw ?? '') : `Error: ${r.error}` },
    })
  } else {
    // 独立部署环境：使用本地内置工具
    registry.register(new ExecTool())
    registry.register(new FileTool())
    registry.register(new FetchTool())
    registry.register(new GitTool())
  }

  return registry
}

function buildSystemPromptWithTools(registry: AgentToolRegistry): string {
  const toolDefs = registry.toOpenAIFunctions()
    .map(t => `- **${t.function.name}**: ${t.function.description}`)
    .join('\n')

  return `你是 Dev Claw，一个资深全栈开发者。

## 可用工具
${toolDefs}

## 调用工具格式
当需要执行工具时，回复：
TOOL_CALL: {"tool": "<tool_name>", "args": {<参数对象>}}

## 任务规范
- 先调用工具了解项目结构，再生成代码
- 生成完整、可运行的代码
- 以 JSON 格式输出修改文件列表：{"files": [{"path": "...", "content": "...", "action": "create|modify"}]}
`
}
