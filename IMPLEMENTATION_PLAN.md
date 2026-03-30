# ClawCompany Multi-Agent 协作系统 - 设计方案

**版本：** v2.0
**创建时间：** 2026-03-23 15:51
**状态：** 待批准
**核心理念：** 更好的系统，不是更简单的系统

---

## 📋 目录

1. [核心设计原则](#核心设计原则)
2. [系统架构](#系统架构)
3. [核心组件](#核心组件)
4. [审核机制 Tradeoff](#审核机制-tradeoff)
5. [任务追踪边界](#任务追踪边界)
6. [实施计划](#实施计划)
7. [文件清单](#文件清单)

---

## 🎯 核心设计原则

### 1. 状态管理 vs 权限控制

**原则：**
- ✅ **状态管理** → 追踪任务进度
- ✅ **权限控制** → 在 Agent 配置层面（SOUL.md / agent-config）

**不采用：**
- ❌ 硬编码的状态机（太死板）
- ❌ 复杂的流程引擎（过度设计）

---

### 2. 审核机制的 Tradeoff

**核心问题：每次通信都需要审核吗？**

**答案：不需要。只在关键节点审核。**

**理由：**
- 审核会增加延迟（5-10 分钟）
- 但能避免方向性错误（节省数小时返工）
- **Tradeoff：质量 > 速度**

---

### 3. 任务追踪的边界

**追踪有价值的信息：**
- 任务状态
- 协作链
- 进度估算

**不追踪无价值的信息：**
- Agent 内部思考（由 Agent 自己管理）
- 详细工作笔记（由 workspace 管理）

---

## 🏗️ 系统架构

### 架构图

```
┌─────────────┐
│    用户     │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────────┐
│         Message Router                │
│  - 接收消息                            │
│  - 检查权限                            │
│  - 决定是否审核                        │
│  - 路由到目标 Agent                    │
└──────┬───────────────────────────────┘
       │
       ├─────────┬─────────┬─────────┐
       │         │         │         │
       ↓         ↓         ↓         ↓
   ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
   │  PM   │ │  Dev  │ │Tester │ │Reviewer│
   │ Agent │ │ Agent │ │ Agent │ │ Agent │
   └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
       │         │         │         │
       │  SOUL.md & MEMORY.md         │
       │         │         │         │
       └─────────┴─────────┴─────────┘
                   │
            ┌──────▼──────┐
            │Task Tracker │
            │ - 状态管理  │
            │ - 协作链    │
            │ - 进度追踪  │
            └─────────────┘
```

---

### 完整流程示例

**场景：实现用户登录功能**

```
1. 用户："帮我实现用户登录功能"

2. Message Router → PM Agent
   
3. PM Agent 分析并制定方案
   输出：{
     plan: "分3步：1)界面 2)认证 3)测试",
     nextAgent: "developer-agent"
   }

4. Router 检测到需要审核（PM → Developer）
   → 发送给 Reviewer Agent ⭐

5. Reviewer Agent 审核
   输出：{
     result: "approved",
     feedback: "方案可行",
     suggestions: ["增加密码强度验证"]
   }

6. Router 收到审核通过
   → 发送给 Developer Agent

7. Developer Agent 实现代码
   输出：{
     files: ["login.ts", "auth.ts"],
     nextAgent: "tester-agent"
   }

8. Router 检测到不需要审核
   → 直接发送给 Tester Agent

9. Tester Agent 测试
   输出：{
     result: "all tests passed",
     nextAgent: "pm-agent"
   }

10. Router → PM Agent

11. PM Agent 总结并回复用户

12. Task Tracker 更新：completed
```

---

## 🔧 核心组件

### 1. Agent Registry（Agent 注册表）

**职责：**
- 管理 Agent 配置
- 定义 Agent 权限
- 定义 Agent 能力

**配置示例：**

```typescript
const AGENT_CONFIGS = {
  'pm-agent': {
    name: 'PM Agent',
    role: 'planner',
    capabilities: ['analyze', 'plan', 'coordinate'],
    
    // 权限：可以发给谁
    canSendTo: ['developer-agent', 'tester-agent', 'reviewer-agent'],
    
    // 职责
    responsibilities: [
      '分析用户需求',
      '制定执行计划',
      '协调团队工作'
    ],
    
    // SOUL.md 路径
    soulPath: '~/.openclaw/agents/pm-agent/SOUL.md',
    memoryPath: '~/.openclaw/agents/pm-agent/MEMORY.md'
  },
  
  'developer-agent': {
    name: 'Developer Agent',
    role: 'implementer',
    capabilities: ['code', 'debug', 'refactor'],
    
    canSendTo: ['pm-agent', 'tester-agent'],
    
    responsibilities: [
      '实现功能代码',
      '修复 bug',
      '优化代码'
    ],
    
    soulPath: '~/.openclaw/agents/developer-agent/SOUL.md',
    memoryPath: '~/.openclaw/agents/developer-agent/MEMORY.md'
  },
  
  'tester-agent': {
    name: 'Tester Agent',
    role: 'validator',
    capabilities: ['test', 'verify', 'report'],
    
    canSendTo: ['pm-agent', 'developer-agent'],
    
    responsibilities: [
      '编写测试用例',
      '执行测试',
      '报告测试结果'
    ],
    
    soulPath: '~/.openclaw/agents/tester-agent/SOUL.md',
    memoryPath: '~/.openclaw/agents/tester-agent/MEMORY.md'
  },
  
  'reviewer-agent': {
    name: 'Reviewer Agent',
    role: 'auditor',
    capabilities: ['review', 'validate', 'approve'],
    
    canSendTo: ['pm-agent'],  // 只能返回审核结果
    
    responsibilities: [
      '审核方案质量',
      '检查风险',
      '提供改进建议'
    ],
    
    soulPath: '~/.openclaw/agents/reviewer-agent/SOUL.md',
    memoryPath: '~/.openclaw/agents/reviewer-agent/MEMORY.md'
  }
};
```

---

### 2. Task Tracker（任务追踪器）

**追踪什么？**

#### 层次 1：任务状态（必须）

```typescript
enum TaskStatus {
  CREATED = 'created',           // 已创建
  ASSIGNED = 'assigned',         // 已分配
  IN_PROGRESS = 'in_progress',   // 进行中
  REVIEWING = 'reviewing',       // 审核中
  COMPLETED = 'completed',       // 已完成
  FAILED = 'failed'              // 失败
}

interface Task {
  id: string;                    // TASK-001
  title: string;
  description: string;
  status: TaskStatus;
  currentAgent: string;          // 当前处理者
  
  // 进度信息
  progress: {
    percentage: number;          // 0-100
    currentStep: string;         // 当前步骤描述
    estimatedTimeRemaining?: number;  // 预计剩余时间（分钟）
  };
  
  // 时间戳
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

#### 层次 2：协作链（推荐）

```typescript
interface CollaborationChain {
  taskId: string;
  
  // 协作历史
  chain: Array<{
    agent: string;           // Agent ID
    agentName: string;       // Agent 名称
    action: string;          // 动作描述
    input: string;           // 输入（从上一个 Agent 接收的）
    output: string;          // 输出（发送给下一个 Agent 的）
    timestamp: string;
    duration: number;        // 耗时（秒）
  }>;
  
  // 当前位置
  currentAgent: string;
  nextAgent?: string;
}
```

#### 层次 3：审核记录（如果启用审核）

```typescript
interface ReviewRecord {
  taskId: string;
  
  reviews: Array<{
    reviewer: string;        // 审核者 Agent
    reviewee: string;        // 被审核者 Agent
    result: 'approved' | 'rejected';
    feedback: string;
    suggestions?: string[];
    timestamp: string;
    duration: number;        // 审核耗时（秒）
  }>;
}
```

---

### 3. Message Router（消息路由器）

**职责：**
- 接收 Agent 的消息
- 检查权限（是否允许发送）
- 决定是否需要审核
- 路由到目标 Agent
- 记录消息历史

**核心逻辑：**

```typescript
class MessageRouter {
  /**
   * 路由消息
   */
  async route(
    fromAgent: string,
    toAgent: string,
    message: string,
    context?: MessageContext
  ): Promise<void> {
    // 1. 检查权限
    if (!this.hasPermission(fromAgent, toAgent)) {
      throw new Error(
        `${fromAgent} 无权发送消息给 ${toAgent}`
      );
    }
    
    // 2. 检查是否需要审核
    const needsReview = this.needsReview(fromAgent, toAgent);
    
    if (needsReview) {
      // 3a. 发送给 Reviewer
      await this.sendToReviewer(fromAgent, toAgent, message, context);
    } else {
      // 3b. 直接发送
      await this.sendDirectly(toAgent, message, context);
    }
    
    // 4. 记录消息
    await this.recordMessage(fromAgent, toAgent, message);
  }
  
  /**
   * 检查权限
   */
  private hasPermission(from: string, to: string): boolean {
    const config = AGENT_CONFIGS[from];
    return config.canSendTo.includes(to);
  }
  
  /**
   * 检查是否需要审核
   */
  private needsReview(from: string, to: string): boolean {
    // 审核规则
    const reviewRules: Record<string, boolean> = {
      'pm-agent→developer-agent': true,     // ✅ 方案审核
      'developer-agent→tester-agent': false, // ❌ 不需要
      'tester-agent→pm-agent': false,        // ❌ 不需要
      'pm-agent→user': true                  // ⚠️ 可选：结果审核
    };
    
    return reviewRules[`${from}→${to}`] || false;
  }
  
  /**
   * 发送给 Reviewer
   */
  private async sendToReviewer(
    from: string,
    to: string,
    message: string,
    context?: MessageContext
  ): Promise<void> {
    // 1. 构造审核请求
    const reviewRequest = `
请审核以下内容：

来源：${from}
目标：${to}

内容：
${message}

上下文：
${JSON.stringify(context, null, 2)}

请审核并给出反馈。
    `.trim();
    
    // 2. 发送给 Reviewer
    await this.sendDirectly('reviewer-agent', reviewRequest, context);
  }
  
  /**
   * 直接发送
   */
  private async sendDirectly(
    to: string,
    message: string,
    context?: MessageContext
  ): Promise<void> {
    // 使用 OpenClaw 的 sessions_send
    await exec(`
      openclaw message send \
        --agent ${to} \
        --message "${message.replace(/"/g, '\\"')}"
    `);
  }
}
```

---

### 4. Agent Workspace

**每个 Agent 的 OpenClaw workspace：**

```
~/.openclaw/agents/
  ├── pm-agent/
  │   ├── SOUL.md           # PM 的角色定义
  │   ├── MEMORY.md         # PM 的长期记忆
  │   ├── workspace/        # PM 的工作空间
  │   │   ├── tasks.json    # 任务列表
  │   │   └── notes.md      # 工作笔记
  │   └── sessions/         # 会话历史
  │
  ├── developer-agent/
  │   ├── SOUL.md
  │   ├── MEMORY.md
  │   └── ...
  │
  ├── tester-agent/
  │   ├── SOUL.md
  │   ├── MEMORY.md
  │   └── ...
  │
  └── reviewer-agent/
      ├── SOUL.md
      ├── MEMORY.md
      └── ...
```

---

## ⚖️ 审核机制 Tradeoff

### 关键问题：每次通信都需要审核吗？

**答案：不需要。只在关键节点审核。**

---

### 场景分析

#### 场景 1：PM → Developer（方案传递）

**需要审核吗？** ✅ **需要**

**理由：**
- PM 可能理解错用户需求
- PM 可能提出不合理的方案
- PM 可能遗漏重要细节
- **风险：** 如果理解错误，后续全是无用功

**效果：**
- 避免方向性错误（最大风险）
- 节省返工时间（可能几小时）

**成本：**
- 延迟：+5-10 分钟

**结论：** ✅ **值得！**

---

#### 场景 2：Developer → Tester（代码移交）

**需要审核吗？** ❌ **不需要**

**理由：**
- Tester 本身就是在检查代码
- 多一层审核意义不大
- 增加延迟

**效果：**
- 无额外价值

**成本：**
- 延迟：+5-10 分钟

**结论：** ❌ **不值得！**

---

#### 场景 3：Tester → PM（结果报告）

**需要审核吗？** ❌ **不需要**

**理由：**
- 只是信息同步，不是决策
- PM 收到结果后，自己判断是否满意

**效果：**
- 无额外价值

**成本：**
- 延迟：+3-5 分钟

**结论：** ❌ **不值得！**

---

### 审核规则总结

| 场景 | 需要审核？ | 理由 | 成本 | 结论 |
|------|-----------|------|------|------|
| PM → Developer | ✅ 是 | 防止方向性错误 | +5-10 分钟 | **值得** |
| Developer → Tester | ❌ 否 | Tester 本身是检查 | +5-10 分钟 | 不值得 |
| Tester → PM | ❌ 否 | 只是信息同步 | +3-5 分钟 | 不值得 |
| PM → User | ⚠️ 可选 | 质量保证 | +3-5 分钟 | 可选 |

---

### 我的建议

**方案：关键节点审核**

```
用户需求 → PM（方案）
           ↓
        [审核] ← Reviewer Agent ⭐ 必须！
           ↓
        Developer（实现）
           ↓
        Tester（测试）← 不需要审核
           ↓
        PM（总结）← 不需要审核
           ↓
        [审核] ← Reviewer Agent（可选）
           ↓
        用户
```

**只在关键节点审核：**
- ✅ 方案阶段（PM → Developer）：必须审核
- ⚠️ 结果阶段（PM → User）：可选审核
- ❌ 其他阶段：不需要审核

**Tradeoff：**
- 速度：+5-10 分钟（可接受）
- 质量：显著提升（避免大方向错误）
- **结论：值得！**

---

## 📏 任务追踪边界

### 追踪什么？

#### 必须追踪（有价值）

1. **任务状态**
   ```typescript
   {
     status: 'in_progress',
     currentAgent: 'developer-agent',
     createdAt: '2026-03-23T10:00:00Z',
     updatedAt: '2026-03-23T10:05:00Z'
   }
   ```

2. **协作链**
   ```typescript
   {
     chain: [
       { agent: 'pm', action: '方案制定', output: '...' },
       { agent: 'reviewer', action: '审核通过', output: '...' },
       { agent: 'developer', action: '实现代码', output: '...' }
     ]
   }
   ```

3. **进度信息**
   ```typescript
   {
     progress: {
       percentage: 40,
       currentStep: '实现认证逻辑',
       estimatedTimeRemaining: 10  // 分钟
     }
   }
   ```

4. **审核记录**（如果启用审核）
   ```typescript
   {
     reviews: [
       {
         reviewer: 'reviewer-agent',
         reviewee: 'pm-agent',
         result: 'approved',
         feedback: '方案可行'
       }
     ]
   }
   ```

---

#### 不追踪（无价值或由其他系统管理）

1. ❌ **Agent 内部思考**
   - 由 Agent 的 session JSONL 管理
   - 不需要在 Task Tracker 中重复

2. ❌ **详细工作笔记**
   - 由 Agent 的 workspace 管理
   - 不是任务层面的信息

3. ❌ **每条消息的详细内容**
   - 只记录关键决策点
   - 详细内容在消息历史中

4. ❌ **工具调用的详细结果**
   - 由 Agent 的 session 管理
   - 只在协作链中记录摘要

---

### 数据结构

#### Task（任务）

```typescript
interface Task {
  // 基本信息
  id: string;
  title: string;
  description: string;
  
  // 状态
  status: TaskStatus;
  currentAgent: string;
  
  // 进度
  progress: {
    percentage: number;
    currentStep: string;
    estimatedTimeRemaining?: number;
  };
  
  // 协作链
  chain: CollaborationRecord[];
  
  // 审核记录
  reviews?: ReviewRecord[];
  
  // 时间戳
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // 元数据
  createdBy: string;    // 用户 ID
  tags?: string[];
  priority?: 'low' | 'normal' | 'high' | 'critical';
}
```

#### CollaborationRecord（协作记录）

```typescript
interface CollaborationRecord {
  agent: string;
  agentName: string;
  action: string;
  input: string;
  output: string;
  timestamp: string;
  duration: number;  // 秒
}
```

---

## 🚀 实施计划

### Phase 1：核心组件（3 天）

**Day 1: Agent Registry + 权限系统**
- [ ] 实现 AgentRegistry 类
- [ ] 定义 4 个 Agent 配置
- [ ] 实现权限检查逻辑
- [ ] 编写单元测试

**Day 2: Task Tracker**
- [ ] 实现 TaskStore（JSON 存储）
- [ ] 实现任务状态管理
- [ ] 实现协作链追踪
- [ ] 实现进度更新
- [ ] 编写单元测试

**Day 3: Message Router + 审核集成**
- [ ] 实现 MessageRouter 类
- [ ] 实现消息路由逻辑
- [ ] 集成审核机制
- [ ] 实现消息记录
- [ ] 编写集成测试

---

### Phase 2：Agent Workspaces（2 天）

**Day 4: 创建 Agent Workspaces**
- [ ] 创建 PM Agent workspace
  - SOUL.md
  - MEMORY.md
  - workspace 结构
- [ ] 创建 Developer Agent workspace
- [ ] 创建 Tester Agent workspace
- [ ] 创建 Reviewer Agent workspace

**Day 5: 测试和优化**
- [ ] E2E 测试完整流程
- [ ] 优化 SOUL.md（调整角色定义）
- [ ] 调整审核规则
- [ ] 性能测试
- [ ] 文档完善

---

### 总计：5 天

---

## 📁 文件清单

### 核心代码（15 个文件）

```
ClawCompany/
├── ai-team-demo/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── agents/
│   │   │   │   ├── registry/
│   │   │   │   │   ├── AgentRegistry.ts      # Agent 注册表
│   │   │   │   │   └── agent-configs.ts      # Agent 配置
│   │   │   │   ├── router/
│   │   │   │   │   ├── MessageRouter.ts      # 消息路由器
│   │   │   │   │   └── ReviewDecider.ts      # 审核决策器
│   │   │   │   └── workspace/
│   │   │   │       ├── WorkspaceManager.ts   # Workspace 管理
│   │   │   │       └── SoulManager.ts        # SOUL.md 管理
│   │   │   ├── storage/
│   │   │   │   ├── TaskStore.ts              # 任务存储
│   │   │   │   └── MessageStore.ts           # 消息存储
│   │   │   └── types/
│   │   │       ├── Agent.ts                  # Agent 类型
│   │   │       ├── Task.ts                   # 任务类型
│   │   │       └── Message.ts                # 消息类型
│   │   └── app/
│   │       └── api/
│   │           ├── agent/
│   │           │   └── route.ts              # Agent API
│   │           └── task/
│   │               └── route.ts              # 任务 API
```

---

### Agent Workspaces（4 个）

```
~/.openclaw/agents/
  ├── pm-agent/
  │   ├── SOUL.md
  │   ├── MEMORY.md
  │   └── workspace/
  │
  ├── developer-agent/
  │   ├── SOUL.md
  │   ├── MEMORY.md
  │   └── workspace/
  │
  ├── tester-agent/
  │   ├── SOUL.md
  │   ├── MEMORY.md
  │   └── workspace/
  │
  └── reviewer-agent/
      ├── SOUL.md
      ├── MEMORY.md
      └── workspace/
```

---

### 测试文件（10 个）

```
ClawCompany/
└── ai-team-demo/
    └── tests/
        ├── agents/
        │   ├── registry/
        │   │   └── AgentRegistry.test.ts
        │   └── workspace/
        │       └── WorkspaceManager.test.ts
        ├── router/
        │   ├── MessageRouter.test.ts
        │   └── ReviewDecider.test.ts
        ├── storage/
        │   ├── TaskStore.test.ts
        │   └── MessageStore.test.ts
        └── e2e/
            ├── full-flow.test.ts
            ├── review-flow.test.ts
            └── permission-check.test.ts
```

---

### 文档（4 个）

```
ClawCompany/
└── docs/
    ├── MULTI_AGENT_GUIDE.md          # 使用指南
    ├── AGENT_DEVELOPMENT.md           # Agent 开发指南
    ├── MESSAGE_FORMAT.md              # 消息格式说明
    └── ROUTING_RULES.md               # 路由规则配置
```

---

## ✅ 总结

### 核心特点

1. **更好的系统，不是更简单的系统**
   - 每个组件都有价值
   - 不追求简单，追求有效

2. **状态管理**
   - 追踪任务生命周期
   - 追踪协作链
   - 不追踪无关细节

3. **权限控制**
   - 在 Agent 配置层面
   - 灵活可扩展
   - 不硬编码

4. **审核机制**
   - 关键节点审核
   - Tradeoff 明确：质量 > 速度
   - 只在值得的地方审核

5. **任务追踪**
   - 界定清楚能力边界
   - 追踪有价值的信息
   - 不追踪无价值的信息

---

### Tradeoff 明确

**审核：**
- ✅ 方案阶段（PM → Developer）：必须
- ❌ 其他阶段：不需要
- **成本：** +5-10 分钟
- **价值：** 避免方向性错误

**追踪：**
- ✅ 任务状态、协作链、进度
- ❌ 内部思考、详细笔记
- **价值：** 可追溯、可分析

---

### 预期效果

**质量：**
- ✅ 避免方向性错误
- ✅ 可追溯责任
- ✅ 质量有保障

**速度：**
- ⚠️ 稍慢（+5-10 分钟）
- ✅ 但避免返工（可能几小时）
- **净效果：更快**

**可维护性：**
- ✅ 结构清晰
- ✅ 权限明确
- ✅ 易于扩展

---

## 📞 下一步

**如果你批准这个方案，我会：**

1. ✅ 立即开始实施 Phase 1
2. ✅ 创建 4 个 Agent workspaces
3. ✅ 实现核心组件
4. ✅ 编写测试

**预计完成：5 天**

---

**请批准后开始实施！** 🚀

---

*版本: v2.0*
*创建时间: 2026-03-23 15:51*
*状态: 待批准*
