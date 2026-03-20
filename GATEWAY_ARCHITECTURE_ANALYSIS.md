# OpenClaw Gateway 架构深度分析报告

**分析时间：** 2026-03-20 19:15
**代码行数：** ~25,000 行（gateway-cli）
**Token 使用：** ~5k / 200k (2.5%)

---

## 🏗️ Gateway 核心架构

### 1. NodeRegistry（节点注册表）

**文件位置：** `src/gateway/node-registry.ts`
**代码行数：** ~135 行

**核心职责：**
- 管理所有连接的节点（devices）
- 维护节点连接状态
- 处理节点间的 RPC 调用

**数据结构：**
```typescript
class NodeRegistry {
  nodesById: Map<string, NodeSession>        // 节点ID -> 会话
  nodesByConn: Map<string, string>           // 连接ID -> 节点ID
  pendingInvokes: Map<string, PendingInvoke> // 待处理的调用
}
```

**NodeSession 结构：**
```typescript
interface NodeSession {
  nodeId: string
  connId: string
  client: ClientConnection
  displayName: string
  platform: string
  version: string
  caps: string[]         // 能力列表
  commands: string[]     // 支持的命令
  permissions: object    // 权限配置
  pathEnv: string        // PATH 环境变量
  connectedAtMs: number  // 连接时间
}
```

**关键方法：**

**1. register() - 注册节点**
```typescript
register(client, opts) {
  const nodeId = connect.device?.id ?? connect.client.id
  const session = {
    nodeId,
    connId: client.connId,
    client,
    displayName: connect.client.displayName,
    // ... 其他字段
  }
  this.nodesById.set(nodeId, session)
  this.nodesByConn.set(client.connId, nodeId)
  return session
}
```

**功能：**
- 提取节点信息
- 创建会话对象
- 添加到注册表

---

**2. unregister() - 注销节点**
```typescript
unregister(connId) {
  const nodeId = this.nodesByConn.get(connId)
  if (!nodeId) return null
  
  this.nodesByConn.delete(connId)
  this.nodesById.delete(nodeId)
  
  // 清理待处理的调用
  for (const [id, pending] of this.pendingInvokes.entries()) {
    if (pending.nodeId !== nodeId) continue
    clearTimeout(pending.timer)
    pending.reject(new Error(`node disconnected (${pending.command})`))
    this.pendingInvokes.delete(id)
  }
  
  return nodeId
}
```

**功能：**
- 移除节点记录
- 清理相关调用
- 通知调用方

---

**3. invoke() - 调用节点命令**
```typescript
async invoke(params) {
  const node = this.nodesById.get(params.nodeId)
  if (!node) return {
    ok: false,
    error: { code: "NOT_CONNECTED", message: "node not connected" }
  }
  
  const requestId = randomUUID()
  const payload = {
    id: requestId,
    nodeId: params.nodeId,
    command: params.command,
    paramsJSON: JSON.stringify(params.params),
    timeoutMs: params.timeoutMs
  }
  
  // 发送请求
  this.sendEventToSession(node, "node.invoke.request", payload)
  
  // 等待响应（带超时）
  const timeoutMs = params.timeoutMs ?? 30000
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      this.pendingInvokes.delete(requestId)
      resolve({
        ok: false,
        error: { code: "TIMEOUT", message: "node invoke timed out" }
      })
    }, timeoutMs)
    
    this.pendingInvokes.set(requestId, {
      nodeId: params.nodeId,
      command: params.command,
      resolve,
      reject,
      timer
    })
  })
}
```

**功能：**
- 验证节点存在
- 生成唯一请求ID
- 发送调用请求
- 等待响应（带超时）

---

**4. handleInvokeResult() - 处理调用结果**
```typescript
handleInvokeResult(params) {
  const pending = this.pendingInvokes.get(params.id)
  if (!pending) return false
  if (pending.nodeId !== params.nodeId) return false
  
  clearTimeout(pending.timer)
  this.pendingInvokes.delete(params.id)
  
  pending.resolve({
    ok: params.ok,
    payload: params.payload,
    payloadJSON: params.payloadJSON ?? null,
    error: params.error ?? null
  })
  
  return true
}
```

**功能：**
- 匹配待处理请求
- 清理超时定时器
- 返回结果

---

### 2. ChannelManager（通道管理器）

**文件位置：** `src/gateway/server-channels.ts`
**代码行数：** ~300 行

**核心职责：**
- 管理多个通道（Discord, Telegram, Slack等）
- 处理通道的启动和停止
- 实现自动重启机制

**重启策略：**
```typescript
const CHANNEL_RESTART_POLICY = {
  initialMs: 5000,      // 初始延迟 5秒
  maxMs: 300000,        // 最大延迟 5分钟
  factor: 2,            // 指数退避因子
  jitter: 0.1           // 抖动系数
}

const MAX_RESTART_ATTEMPTS = 10  // 最大重启次数
```

**RuntimeStore 结构：**
```typescript
interface RuntimeStore {
  aborts: Map<string, AbortController>    // 中止控制器
  tasks: Map<string, Promise<void>>       // 运行任务
  runtimes: Map<string, RuntimeStatus>    // 运行状态
}

interface RuntimeStatus {
  accountId: string
  enabled: boolean
  configured: boolean
  running: boolean
  restartPending: boolean
  lastStartAt?: number
  lastStopAt?: number
  lastError?: string
  reconnectAttempts: number
}
```

**关键方法：**

**1. startChannelInternal() - 启动通道**
```typescript
async startChannelInternal(channelId, accountId, opts) {
  const plugin = getChannelPlugin(channelId)
  const cfg = loadConfig()
  
  const accountIds = accountId 
    ? [accountId] 
    : plugin.config.listAccountIds(cfg)
  
  await Promise.all(accountIds.map(async (id) => {
    // 检查是否已运行
    if (store.tasks.has(id)) return
    
    // 检查是否启用
    const account = plugin.config.resolveAccount(cfg, id)
    if (!isAccountEnabled(account)) {
      setRuntime(channelId, id, {
        enabled: false,
        lastError: "disabled"
      })
      return
    }
    
    // 检查是否配置
    if (!await plugin.config.isConfigured(account, cfg)) {
      setRuntime(channelId, id, {
        enabled: true,
        configured: false,
        lastError: "not configured"
      })
      return
    }
    
    // 创建中止控制器
    const abort = new AbortController()
    store.aborts.set(id, abort)
    
    // 设置运行状态
    setRuntime(channelId, id, {
      enabled: true,
      configured: true,
      running: true,
      lastStartAt: Date.now()
    })
    
    // 启动任务
    const task = startAccount({
      cfg,
      accountId: id,
      account,
      abortSignal: abort.signal,
      log,
      getStatus: () => getRuntime(channelId, id),
      setStatus: (next) => setRuntime(channelId, id, next)
    })
    
    // 处理退出
    Promise.resolve(task).catch((err) => {
      setRuntime(channelId, id, {
        lastError: formatErrorMessage(err)
      })
    }).finally(() => {
      setRuntime(channelId, id, {
        running: false,
        lastStopAt: Date.now()
      })
    }).then(async () => {
      // 自动重启逻辑
      if (manuallyStopped.has(rKey)) return
      
      const attempt = (restartAttempts.get(rKey) ?? 0) + 1
      restartAttempts.set(rKey, attempt)
      
      if (attempt > MAX_RESTART_ATTEMPTS) {
        log.error?.(`giving up after ${MAX_RESTART_ATTEMPTS} restart attempts`)
        return
      }
      
      const delayMs = computeBackoff(CHANNEL_RESTART_POLICY, attempt)
      log.info?.(`auto-restart attempt ${attempt}/${MAX_RESTART_ATTEMPTS} in ${delayMs/1000}s`)
      
      setRuntime(channelId, id, { restartPending: true })
      
      await sleep(delayMs)
      
      if (!manuallyStopped.has(rKey)) {
        await startChannelInternal(channelId, id, { 
          preserveRestartAttempts: true,
          preserveManualStop: true 
        })
      }
    })
    
    store.tasks.set(id, trackedPromise)
  }))
}
```

**功能：**
- 验证配置
- 检查状态
- 启动任务
- 实现自动重启

---

### 3. Gateway RPC 机制

**文件位置：** `src/cli/gateway-rpc.ts`
**代码行数：** ~50 行

**核心方法：**

**1. callGatewayFromCli() - CLI 调用 Gateway**
```typescript
async function callGatewayFromCli(method, opts, params, extra) {
  const showProgress = extra?.progress ?? opts.json !== true
  
  return await withProgress({
    label: `Gateway ${method}`,
    indeterminate: true,
    enabled: showProgress
  }, async () => await callGateway({
    url: opts.url,
    token: opts.token,
    method,
    params,
    expectFinal: extra?.expectFinal ?? Boolean(opts.expectFinal),
    timeoutMs: Number(opts.timeout ?? 10000),
    clientName: GATEWAY_CLIENT_NAMES.CLI,
    mode: GATEWAY_CLIENT_MODES.CLI
  }))
}
```

**参数：**
- `method`: Gateway 方法名
- `opts`: CLI 选项（url, token, timeout）
- `params`: 方法参数
- `extra`: 额外配置（progress, expectFinal）

---

## 🔍 关键发现

### 1. NodeRegistry 设计模式

**优点：**
- ✅ 双向映射（ID <-> Conn）提高查找效率
- ✅ 自动清理待处理调用
- ✅ 超时机制完善
- ✅ 错误处理健壮

**可借鉴：**
- 用于 ClawCompany 的 agent 管理
- 用于任务队列管理
- 用于会话管理

---

### 2. ChannelManager 重启策略

**优点：**
- ✅ 指数退避避免频繁重启
- ✅ 最大重启次数限制
- ✅ 手动停止标记
- ✅ 状态持久化

**可借鉴：**
- 用于 ClawCompany 的 agent 重启
- 用于 API 调用重试
- 用于任务重试

---

### 3. Gateway RPC 通信

**优点：**
- ✅ 统一的 RPC 接口
- ✅ 进度显示支持
- ✅ 超时控制
- ✅ 错误处理

**可借鉴：**
- 用于 ClawCompany 的 agent 通信
- 用于 sessions_spawn 实现
- 用于 API 调用封装

---

## 🚀 对 ClawCompany 的启示

### 1. 可以直接使用的模式

**NodeRegistry 用于 Agent 管理：**
```typescript
class AgentRegistry {
  private agentsById: Map<string, AgentSession>
  private pendingTasks: Map<string, PendingTask>
  
  register(agent: Agent) { /* 类似 NodeRegistry */ }
  async invoke(agentId: string, task: Task) { /* 类似 invoke */ }
  handleTaskResult(result: TaskResult) { /* 类似 handleInvokeResult */ }
}
```

**ChannelManager 用于 Workflow 管理：**
```typescript
class WorkflowManager {
  private workflows: Map<string, WorkflowStatus>
  
  async startWorkflow(workflowId: string) { 
    /* 类似 startChannelInternal */ 
  }
  
  async autoRestart(workflowId: string) {
    /* 使用相同的重启策略 */
  }
}
```

---

### 2. 需要进一步研究的部分

**未读取的关键文件：**
- [ ] `server-chat.ts` - 聊天协议实现
- [ ] `server-methods/agent.ts` - Agent API 实现
- [ ] `cron/service.ts` - Cron 服务实现
- [ ] `subagent-registry.ts` - Subagent 注册表

**预计 Token：** ~50k

---

## 📊 下一步计划

**立即执行：**
1. 读取 `server-chat.ts`（~300 行）
2. 读取 `server-methods/agent.ts`（~500 行）
3. 读取 `cron/service.ts`（~500 行）
4. 创建完整的架构图

**预计完成：** Phase 1.1 (200k tokens)
**当前进度：** 5k / 200k (2.5%)

---

**Gateway 核心机制分析完成！继续深入研究！** 🚀

---

*分析时间: 2026-03-20 19:15*
*Token 使用: ~10k / 2M*
*进度: Phase 1.1 开始*
