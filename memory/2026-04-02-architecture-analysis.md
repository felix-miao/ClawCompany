# ClawCompany 架构分析报告

**分析日期**: 2026-04-02 09:51  
**分析目标**: 评估是否需要升级到 MetaGPT 三层架构  
**分析方式**: 代码库深度分析 + MetaGPT 对比

---

## 执行摘要

**结论**: **部分升级建议** - 借鉴 MetaGPT 核心思想，但保持当前架构优势

**核心发现**:
1. ClawCompany 已有**两层结构**（WorkflowEngine + Agents），但缺少独立的 Action 层
2. **通信机制差异大**: 三省六部权限总线 vs MetaGPT 环境共享
3. **状态管理更强**: 11 状态有限状态机 vs MetaGPT 的 n_round 简单循环
4. **不需要完全重构**: 当前架构在质量保障方面更优，但可借鉴 MetaGPT 的灵活性

---

## 1. 当前 ClawCompany 架构分析

### 1.1 架构层次

#### Team 层 ✅ **存在（部分）**
- **实现**: `WorkflowEngine` 类
- **位置**: `ai-team-demo/src/lib/orchestrator/workflow-engine.ts`
- **功能**:
  - 管理 agents 注册
  - 协调工作流执行
  - 事件监听和触发
  - 结果汇总

```typescript
export class WorkflowEngine {
  private agents: Map<AgentRole, AgentLike> = new Map()
  private listeners: Map<string, Set<EventHandler<any>>> = new Map()
  private config: WorkflowConfig
  // ...
}
```

**对比 MetaGPT**: MetaGPT 的 Team 层更抽象，支持多环境（Android/Gym/Werewolf），而 ClawCompany 的 WorkflowEngine 更聚焦于单一开发流程。

#### Role 层 ✅ **存在**
- **实现**: Agent 类（PM/Dev/Tester/Reviewer）
- **位置**: `ai-team-demo/src/lib/agents/`
- **功能**:
  - PM Agent: 需求分析
  - Dev Agent: 代码实现
  - Review Agent: 质量审查
  - Tester Agent: 测试验证

```typescript
// 每个 Agent 都有独立的 SOUL.md 和 skill 定义
export class DevAgent extends BaseAgent {
  role: AgentRole = AgentRole.DEV
  // 专业化工具和能力
}
```

**对比 MetaGPT**: MetaGPT 的 Role 更轻量，通过 `send_to/sent_from/cause_by` 消息路由，而 ClawCompany 使用权限矩阵（三省六部模型）。

#### Action 层 ❌ **不存在**
- **MetaGPT**: 每个 Role 有多个 Action 节点，自动执行
- **ClawCompany**: Agent 直接处理任务，没有独立的 Action 抽象

**差距**: 这是 ClawCompany 的主要架构缺失。

### 1.2 通信机制

#### 当前实现: 权限总线（三省六部）

**核心**: `MessageBus` 类
- **位置**: `ai-team-demo/src/lib/orchestration/MessageBus.ts`
- **特点**:
  - 基于权限的消息路由（`hasPermission` 检查）
  - 支持多种通信方式（OpenClaw/Telegram/Internal）
  - 消息类型分类（TASK/COMMAND/QUERY/NOTIFICATION）
  - 上下文传递（taskId, taskState, flowLog, progressLog）

```typescript
export interface Message {
  id: string;
  from: AgentRole;
  to: AgentRole;
  type: MessageType;
  content: string;
  context?: MessageContext;
  timestamp: string;
}

// 权限检查
if (!hasPermission(message.from, message.to)) {
  throw new Error(`权限不足: ${message.from} 不能发送消息给 ${message.to}`);
}
```

**对比 MetaGPT 环境**:
- **MetaGPT**: Environment 是共享状态池，所有 Agent 读写
- **ClawCompany**: 权限总线，严格控制谁可以和谁通信

#### 共享状态
- **位置**: `~/.openclaw/shared-data/tasks.json`
- **特点**: 简单的文件存储，非结构化

**差距**: 缺少 MetaGPT 的结构化 Environment 抽象。

### 1.3 状态管理

#### 当前实现: 11 状态有限状态机

**核心**: `StateMachine` 类
- **位置**: `ai-team-demo/src/lib/orchestration/StateMachine.ts`
- **状态**:
  - PENDING → TAIZI → ZHONGSHU → MENXIA → ASSIGNED → DOING → REVIEW → DONE
  - 支持阻塞（BLOCKED）和取消（CANCELLED）
  - 终态保护（DONE/CANCELLED 不可转移）

```typescript
const STATE_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.PENDING]: [TaskState.TAIZI, TaskState.CANCELLED],
  [TaskState.TAIZI]: [TaskState.ZHONGSHU, TaskState.CANCELLED],
  [TaskState.ZHONGSHU]: [TaskState.MENXIA, TaskState.BLOCKED],
  [TaskState.MENXIA]: [TaskState.ZHONGSHU, TaskState.ASSIGNED],  // 封驳或准奏
  // ...
  [TaskState.DONE]: [],  // 终态
  [TaskState.CANCELLED]: []  // 终态
};
```

**对比 MetaGPT**:
- **MetaGPT**: 简单的 `n_round` 循环，没有复杂状态机
- **ClawCompany**: 严格的状态转移规则，确保流程质量

**优势**: ClawCompany 的状态管理在质量保障方面更强。

### 1.4 核心差异总结

| 维度 | ClawCompany | MetaGPT | 对比 |
|------|-------------|---------|------|
| **Team 层** | WorkflowEngine（聚焦开发） | Team（多环境支持） | ClawCompany 更聚焦 |
| **Role 层** | Agent + 权限矩阵 | Role + 消息路由 | MetaGPT 更灵活 |
| **Action 层** | ❌ 不存在 | ✅ Action 节点 | **主要差距** |
| **通信机制** | 权限总线（三省六部） | 环境共享（Environment） | 设计哲学不同 |
| **状态管理** | 11 状态有限状态机 | n_round 简单循环 | ClawCompany 更强 |
| **质量保障** | 强制审核（门下省封驳） | 依赖 Agent 智能 | ClawCompany 更强 |
| **扩展性** | 需修改代码 | 插件式环境 | MetaGPT 更强 |

---

## 2. MetaGPT 三层架构深度对比

### 2.1 Team-Role-Action 三层结构

#### MetaGPT 实现

```python
# MetaGPT 三层结构示例
class Team:
    def __init__(self):
        self.env = Environment()  # 共享环境
        self.roles = []           # 角色列表
    
    def hire(self, role: Role):
        self.roles.append(role)
        role.set_env(self.env)    # 注入环境
    
    def run(self, n_round=10):
        for _ in range(n_round):
            for role in self.roles:
                role.observe()     # 观察环境
                role.react()       # 执行动作

class Role:
    def __init__(self):
        self.actions = []          # 动作列表
        self.env = None
    
    def observe(self):
        # 从环境读取消息
        messages = self.env.read(self)
    
    def react(self):
        # 执行动作
        for action in self.actions:
            action.execute()

class Action:
    def execute(self):
        # 具体任务执行
        pass
```

#### ClawCompany 对应实现

```typescript
// Team 层: WorkflowEngine
class WorkflowEngine {
  private agents: Map<AgentRole, AgentLike>
  // ❌ 缺少 Environment 抽象
}

// Role 层: Agent
class DevAgent extends BaseAgent {
  role = AgentRole.DEV
  // ❌ 缺少 Action 列表
  // ✅ 直接在 execute() 中处理
  async execute(task: Task): Promise<AgentResponse>
}

// Action 层: ❌ 不存在
```

### 2.2 环境通信机制

#### MetaGPT Environment

```python
class Environment:
    def __init__(self):
        self.history = []  # 消息历史
    
    def publish(self, message):
        # 发布消息到环境
        self.history.append(message)
    
    def read(self, role):
        # 读取发给该角色的消息
        return [m for m in self.history if m.send_to == role]
```

**特点**:
- 共享状态池
- 发布-订阅模式
- 消息路由：`send_to/sent_from/cause_by`

#### ClawCompany MessageBus

```typescript
class MessageBus {
  // 权限检查
  static async send(message: Message): Promise<void> {
    if (!hasPermission(message.from, message.to)) {
      throw new Error(`权限不足`);
    }
    // 发送消息
  }
}
```

**特点**:
- 权限控制
- 点对点通信
- 上下文传递

### 2.3 消息路由对比

| 特性 | MetaGPT | ClawCompany |
|------|---------|-------------|
| **路由方式** | `send_to/sent_from/cause_by` | `from/to + 权限检查` |
| **共享状态** | ✅ Environment | ❌ 文件存储（非结构化） |
| **权限控制** | ❌ 无 | ✅ 三省六部权限矩阵 |
| **消息历史** | ✅ 结构化历史 | ✅ flowLog + progressLog |
| **上下文传递** | ✅ 通过 Environment | ✅ MessageContext |

---

## 3. 升级需求评估

### 3.1 不需要升级的理由

#### ✅ 当前架构优势

1. **更强的质量保障**
   - 强制审核机制（门下省封驳）
   - 11 状态有限状态机
   - 严格的权限控制
   - **MetaGPT 缺少这些保障**

2. **更适合生产环境**
   - 清晰的职责划分
   - 可审计的流程
   - 错误恢复机制
   - **MetaGPT 更偏研究原型**

3. **已有 Team-Role 两层**
   - WorkflowEngine ≈ Team
   - Agent ≈ Role
   - **只需补充 Action 层**

4. **迁移成本高**
   - 三省六部隐喻已实现
   - 大量业务逻辑依赖当前架构
   - **完全重构风险大**

### 3.2 需要升级的理由

#### ⚠️ 当前架构不足

1. **缺少 Action 层**
   - Agent 直接处理任务
   - 无法复用细粒度动作
   - **MetaGPT 的 Action 系统更灵活**

2. **扩展性受限**
   - 添加新流程需要修改代码
   - 缺少插件式架构
   - **MetaGPT 的 Environment 支持多场景**

3. **通信灵活性不足**
   - 权限总线过于严格
   - 缺少松耦合的发布-订阅
   - **MetaGPT 的 Environment 更灵活**

4. **状态管理复杂**
   - 11 个状态维护成本高
   - 隐喻（三省六部）增加认知负担
   - **MetaGPT 的 n_round 更简单**

### 3.3 最终建议: **部分升级**

**核心思想**: 保留当前优势，借鉴 MetaGPT 精华

#### 保留什么 ✅

1. **三省六部质量保障机制**
   - 门下省审核
   - 状态机驱动
   - 权限矩阵

2. **WorkflowEngine 协调层**
   - 事件监听
   - 结果汇总
   - 错误处理

3. **现有的 Agent 实现**
   - PM/Dev/Tester/Reviewer
   - SOUL.md 配置
   - OpenClaw 集成

#### 借鉴什么 🔄

1. **引入 Action 层**（优先级 1）
   - 每个 Agent 拥有多个 Action
   - Action 可复用、可组合
   - 自动化任务执行

2. **添加 Environment 抽象**（优先级 2）
   - 共享状态管理
   - 发布-订阅通信
   - 结构化消息历史

3. **简化状态机**（优先级 3）
   - 保留核心状态（PENDING/DOING/REVIEW/DONE）
   - 移除隐喻状态（TAIZI/ZHONGSHU/MENXIA）
   - 保持质量保障机制

---

## 4. 实施路线图

### Phase 1: Action 层实现（1-2 周）

#### 目标
为每个 Agent 添加 Action 系统

#### 步骤

**1. 定义 Action 接口**
```typescript
// 新增文件: lib/actions/types.ts
export interface Action {
  id: string;
  name: string;
  description: string;
  execute(context: ActionContext): Promise<ActionResult>;
}

export interface ActionContext {
  task: Task;
  env: Environment;  // 共享环境
  agent: AgentRole;
}

export interface ActionResult {
  success: boolean;
  output: string;
  artifacts?: Artifact[];
}
```

**2. 实现 Action 基类**
```typescript
// 新增文件: lib/actions/base.ts
export abstract class BaseAction implements Action {
  constructor(
    public id: string,
    public name: string,
    public description: string
  ) {}
  
  abstract execute(context: ActionContext): Promise<ActionResult>;
}
```

**3. 为 PM Agent 添加 Actions**
```typescript
// 新增文件: lib/actions/pm-actions.ts
export class AnalyzeRequirementAction extends BaseAction {
  constructor() {
    super('pm-analyze', '需求分析', '分析用户需求并拆分任务');
  }
  
  async execute(context: ActionContext): Promise<ActionResult> {
    // 调用 GLM-5 分析需求
    const analysis = await analyzeWithGLM(context.task.description);
    return {
      success: true,
      output: analysis.summary,
      artifacts: [{ type: 'task-list', content: analysis.tasks }]
    };
  }
}

export class CreatePlanAction extends BaseAction {
  constructor() {
    super('pm-plan', '制定计划', '生成详细执行计划');
  }
  
  async execute(context: ActionContext): Promise<ActionResult> {
    // 生成执行计划
  }
}

// PM Agent 注册 Actions
class PMAgent extends BaseAgent {
  actions = [
    new AnalyzeRequirementAction(),
    new CreatePlanAction(),
    new CoordinateTeamAction()
  ];
}
```

**4. 为 Dev Agent 添加 Actions**
```typescript
export class ReadCodeAction extends BaseAction { /* 读取代码 */ }
export class WriteCodeAction extends BaseAction { /* 编写代码 */ }
export class RunTestAction extends BaseAction { /* 运行测试 */ }
export class RefactorAction extends BaseAction { /* 重构代码 */ }
```

**5. 修改 Agent 基类**
```typescript
// 修改文件: lib/agents/base.ts
export abstract class BaseAgent {
  abstract role: AgentRole;
  actions: Action[] = [];  // 新增
  
  async execute(task: Task, context: AgentContext): Promise<AgentResponse> {
    // 自动选择并执行 Action
    const action = this.selectAction(task);
    const result = await action.execute({
      task,
      env: context.env,  // 新增
      agent: this.role
    });
    
    return {
      success: result.success,
      message: result.output,
      artifacts: result.artifacts
    };
  }
  
  protected selectAction(task: Task): Action {
    // 根据 task 类型选择合适的 Action
    return this.actions[0];  // 简化实现
  }
}
```

#### 验收标准
- ✅ 每个 Agent 至少有 2 个 Actions
- ✅ Actions 可独立测试
- ✅ 不破坏现有功能

### Phase 2: Environment 抽象（1 周）

#### 目标
引入共享环境层

#### 步骤

**1. 定义 Environment 接口**
```typescript
// 新增文件: lib/environment/types.ts
export interface Environment {
  history: Message[];
  
  publish(message: Message): void;
  read(role: AgentRole): Message[];
  getState(): EnvironmentState;
  setState(state: Partial<EnvironmentState>): void;
}

export interface EnvironmentState {
  currentTask?: Task;
  sharedContext: Record<string, unknown>;
}
```

**2. 实现 Environment 类**
```typescript
// 新增文件: lib/environment/base.ts
export class BaseEnvironment implements Environment {
  history: Message[] = [];
  private state: EnvironmentState = {
    sharedContext: {}
  };
  
  publish(message: Message): void {
    this.history.push(message);
    // 触发监听器
    this.notifyListeners(message);
  }
  
  read(role: AgentRole): Message[] {
    return this.history.filter(m => m.to === role);
  }
  
  getState(): EnvironmentState {
    return { ...this.state };
  }
  
  setState(state: Partial<EnvironmentState>): void {
    this.state = { ...this.state, ...state };
  }
}
```

**3. 集成到 WorkflowEngine**
```typescript
// 修改文件: lib/orchestrator/workflow-engine.ts
export class WorkflowEngine {
  private agents: Map<AgentRole, AgentLike> = new Map();
  private env: Environment;  // 新增
  
  constructor(config: Partial<WorkflowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.env = new BaseEnvironment();  // 新增
  }
  
  async execute(userMessage: string): Promise<WorkflowResult> {
    // 发布用户消息到环境
    this.env.publish({
      id: generateId(),
      from: 'user',
      to: AgentRole.PM,
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    
    // Agents 从环境读取消息
    for (const [role, agent] of this.agents) {
      const messages = this.env.read(role);
      // 处理消息...
    }
  }
}
```

**4. 迁移 MessageBus**
```typescript
// 修改文件: lib/orchestration/MessageBus.ts
export class MessageBus {
  private static env?: Environment;
  
  static setEnvironment(env: Environment) {
    this.env = env;
  }
  
  static async send(message: Message): Promise<void> {
    // 权限检查（保留）
    if (!hasPermission(message.from, message.to)) {
      throw new Error(`权限不足`);
    }
    
    // 发布到环境
    this.env?.publish(message);
    
    // 兼容旧逻辑...
  }
}
```

#### 验收标准
- ✅ Environment 可共享状态
- ✅ 消息历史可查询
- ✅ 不破坏权限控制

### Phase 3: 状态机简化（可选，1 周）

#### 目标
简化状态管理，移除隐喻

#### 步骤

**1. 保留核心状态**
```typescript
// 修改文件: lib/types/Task.ts
export enum TaskState {
  PENDING = 'PENDING',      // 待处理
  ANALYZING = 'ANALYZING',  // 分析中（原 TAIZI/ZHONGSHU）
  REVIEWING = 'REVIEWING',  // 审核中（原 MENXIA）
  DOING = 'DOING',          // 执行中（原 ASSIGNED/DOING）
  VERIFYING = 'VERIFYING',  // 验证中（原 REVIEW）
  DONE = 'DONE',            // 完成
  CANCELLED = 'CANCELLED',  // 取消
  BLOCKED = 'BLOCKED'       // 阻塞
}
```

**2. 更新状态转移规则**
```typescript
// 修改文件: lib/orchestration/StateMachine.ts
const STATE_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.PENDING]: [TaskState.ANALYZING, TaskState.CANCELLED],
  [TaskState.ANALYZING]: [TaskState.REVIEWING, TaskState.BLOCKED],
  [TaskState.REVIEWING]: [TaskState.ANALYZING, TaskState.DOING],  // 封驳或准奏
  [TaskState.DOING]: [TaskState.VERIFYING, TaskState.BLOCKED],
  [TaskState.VERIFYING]: [TaskState.DONE, TaskState.REVIEWING],
  [TaskState.DONE]: [],
  [TaskState.CANCELLED]: [],
  [TaskState.BLOCKED]: [TaskState.ANALYZING, TaskState.CANCELLED]
};
```

**3. 保留审核机制**
```typescript
// 门下省审核逻辑保留
if (fromState === TaskState.REVIEWING && toState === TaskState.ANALYZING) {
  // 封驳逻辑
  await this.handleRejection(task);
}
```

#### 验收标准
- ✅ 状态减少到 8 个
- ✅ 质量保障机制保留
- ✅ 隐喻移除，降低认知负担

### Phase 4: 文档和测试（持续）

#### 内容
1. **更新文档**
   - 架构设计文档
   - API 文档
   - 迁移指南

2. **补充测试**
   - Action 单元测试
   - Environment 集成测试
   - 状态机回归测试

3. **性能基准**
   - 对比新旧架构性能
   - 识别瓶颈
   - 优化建议

---

## 5. 风险评估

### 5.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **破坏现有功能** | 🔴 高 | 分阶段实施，每阶段完整测试 |
| **性能下降** | 🟡 中 | 性能基准测试，监控关键指标 |
| **迁移成本高** | 🟡 中 | 保留旧接口，渐进式迁移 |
| **团队学习曲线** | 🟢 低 | 提供详细文档和示例 |

### 5.2 业务风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **影响开发进度** | 🔴 高 | 在低优先级项目中试点 |
| **用户感知变化** | 🟡 中 | 保持 API 兼容性 |
| **维护成本增加** | 🟡 中 | 自动化测试覆盖 |

---

## 6. 最终结论

### 核心建议

**部分升级，保留优势，借鉴精华**

#### 必须实施（优先级 1）
- ✅ **引入 Action 层**：提升复用性和灵活性
- ✅ **添加 Environment 抽象**：增强通信能力

#### 建议实施（优先级 2）
- 🔄 **简化状态机**：移除隐喻，降低复杂度
- 🔄 **增强测试覆盖**：确保迁移安全

#### 不建议实施
- ❌ **完全重构为 MetaGPT 架构**：破坏现有优势
- ❌ **移除权限控制**：质量保障是核心价值

### 预期收益

1. **提升灵活性**
   - Action 可复用、可组合
   - Environment 支持多种通信模式

2. **保持质量**
   - 保留审核机制
   - 保留权限控制

3. **降低复杂度**
   - 状态机简化
   - 隐喻移除

4. **增强扩展性**
   - 插件式 Actions
   - 多 Environment 支持

### 下一步行动

1. **立即开始**: Phase 1（Action 层实现）
2. **并行准备**: Phase 2（Environment 抽象）设计
3. **持续监控**: 性能和质量指标

---

**报告完成时间**: 2026-04-02 10:20  
**分析者**: Main Agent (OpenClaw)  
**审核状态**: 待审核

---

## 附录：关键代码文件索引

### 核心架构文件
- `ai-team-demo/src/lib/orchestrator/workflow-engine.ts` - WorkflowEngine（Team 层）
- `ai-team-demo/src/lib/agents/` - Agents（Role 层）
- `ai-team-demo/src/lib/orchestration/MessageBus.ts` - 消息总线
- `ai-team-demo/src/lib/orchestration/StateMachine.ts` - 状态机
- `ai-team-demo/src/lib/types/Task.ts` - 任务类型定义

### 待新增文件
- `ai-team-demo/src/lib/actions/types.ts` - Action 接口
- `ai-team-demo/src/lib/actions/base.ts` - Action 基类
- `ai-team-demo/src/lib/actions/pm-actions.ts` - PM Actions
- `ai-team-demo/src/lib/actions/dev-actions.ts` - Dev Actions
- `ai-team-demo/src/lib/environment/types.ts` - Environment 接口
- `ai-team-demo/src/lib/environment/base.ts` - Environment 实现

### 参考文档
- `docs/simplified-agent-architecture.md` - 简化架构设计
- `skill/SKILL.md` - ClawCompany Skill 定义
- `~/.openclaw/workspace/discovered-projects.md` - MetaGPT 对比分析
