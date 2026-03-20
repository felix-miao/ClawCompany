# OpenClaw Gateway 集成

## 概述

ClawCompany 现在支持真实的 OpenClaw Gateway 集成，允许 Dev Claw 通过 WebSocket 调用真实的 `sessions_spawn` API。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Dev Claw                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  模式选择：mock | llm | openclaw                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  OpenClaw Agent Executor                            │    │
│  │  - executeDevAgent()                                │    │
│  │  - executePMAgent()                                 │    │
│  │  - executeReviewAgent()                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  OpenClaw Gateway Client                            │    │
│  │  - sessions_spawn()                                 │    │
│  │  - sessions_history()                               │    │
│  │  - waitForCompletion()                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ WebSocket RPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenClaw Gateway (ws://127.0.0.1:18789)        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  sessions.spawn                                     │    │
│  │  - runtime: "subagent" | "acp"                      │    │
│  │  - task: string                                     │    │
│  │  - thinking: "low" | "medium" | "high"              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 使用方式

### 1. 环境变量配置

```bash
# 启用 OpenClaw Gateway 模式（用于 LLM Provider）
USE_REAL_GATEWAY=true

# 或使用 Mock 模式（用于 Demo）
USE_MOCK_LLM=true

# Gateway URL（默认：ws://127.0.0.1:18789）
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789

# Gateway Token（可选）
OPENCLAW_GATEWAY_TOKEN=your_token_here
```

### 2. 确保 Gateway 运行

```bash
# 启动 OpenClaw Gateway
openclaw gateway run

# 或作为服务运行
openclaw gateway start
```

### 3. 代码中使用

```typescript
import { DevAgent } from '@/lib/agents/dev-agent'
import { getAgentExecutor } from '@/lib/gateway'

// 方式 1: 通过环境变量自动选择模式
const agent = new DevAgent() // 自动检测 USE_OPENCLAW_GATEWAY

// 方式 2: 显式指定模式
const agent = new DevAgent({ mode: 'openclaw' })

// 方式 3: 直接使用 Executor
const executor = getAgentExecutor()
await executor.connect()

const result = await executor.executeDevAgent(
  '实现登录表单',
  '包含邮箱和密码字段'
)

console.log(result.content)
await executor.disconnect()
```

## API 参考

### OpenClawGatewayClient

```typescript
class OpenClawGatewayClient {
  constructor(url?: string, options?: GatewayOptions)
  
  // 连接到 Gateway
  async connect(): Promise<void>
  
  // 断开连接
  async disconnect(): Promise<void>
  
  // 检查连接状态
  isConnected(): boolean
  
  // 通用 RPC 调用
  async call<T>(method: string, params: object): Promise<T>
  
  // Spawn 子 Agent
  async sessions_spawn(options: SpawnOptions): Promise<SpawnResult>
  
  // 获取 Session 历史
  async sessions_history(sessionKey: string, limit?: number): Promise<HistoryMessage[]>
  
  // 等待完成
  async waitForCompletion(sessionKey: string, timeout?: number): Promise<string>
}
```

### SpawnOptions

```typescript
interface SpawnOptions {
  task: string                    // 任务描述
  label?: string                  // 标签（用于日志/UI）
  runtime?: 'subagent' | 'acp'    // 运行时类型
  agentId?: string                // Agent ID
  model?: string                  // 模型覆盖
  thinking?: 'low' | 'medium' | 'high'  // 思考级别
  cwd?: string                    // 工作目录
  runTimeoutSeconds?: number      // 超时时间
  thread?: boolean                // 是否绑定线程
  mode?: 'run' | 'session'        // 运行模式
  cleanup?: 'delete' | 'keep'     // 清理策略
  sandbox?: 'inherit' | 'require' // 沙箱设置
  streamTo?: 'parent'             // 流式输出目标
}
```

### OpenClawAgentExecutor

```typescript
class OpenClawAgentExecutor {
  constructor(client?: OpenClawGatewayClient)
  
  // 连接
  async connect(): Promise<void>
  
  // 断开
  async disconnect(): Promise<void>
  
  // 通用 Agent 执行
  async executeAgent(
    role: 'pm' | 'dev' | 'review',
    task: string,
    options?: Partial<AgentSpawnConfig>
  ): Promise<AgentExecutionResult>
  
  // PM Claw 专用
  async executePMAgent(task: string): Promise<AgentExecutionResult>
  
  // Dev Claw 专用（使用 ACP runtime）
  async executeDevAgent(task: string, description?: string): Promise<AgentExecutionResult>
  
  // Review Claw 专用
  async executeReviewAgent(task: string, code?: string): Promise<AgentExecutionResult>
}
```

## 测试

```bash
# 运行 Gateway 相关测试
npm test -- --testPathPatterns=gateway

# 运行 Dev Claw 测试
npm test -- --testPathPatterns=dev-agent
```

## 注意事项

1. **运行时选择**：
   - PM Claw: `subagent` runtime
   - Dev Claw: `acp` runtime (支持真实代码执行)
   - Review Claw: `subagent` runtime

2. **超时设置**：
   - PM Claw: 300 秒
   - Dev Claw: 600 秒
   - Review Claw: 180 秒

3. **回退机制**：
   - OpenClaw 调用失败时自动回退到 mock 模式
   - 确保应用在 Gateway 不可用时仍能正常工作

4. **连接管理**：
   - 使用单例模式管理 Gateway 连接
   - 自动重连机制（待实现）
