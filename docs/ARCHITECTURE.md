# ClawCompany 系统设计文档

## 项目愿景

**一人企业家 + AI 虚拟团队** —— 一个程序员 = 一支完整团队

通过多个 AI Agent 协作，实现：
- PM Agent：需求分析、任务拆分、进度追踪
- Dev Agent：代码实现、功能开发
- Review Agent：代码审查、质量保证

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Frontend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Landing     │  │ Dashboard   │  │ Team Chat           │  │
│  │ Page        │  │ (项目管理)   │  │ (Agent 协作界面)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ /api/chat   │  │ /api/task   │  │ /api/agent/*        │  │
│  │ (对话接口)   │  │ (任务管理)   │  │ (Agent 控制)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Task Dispatcher                      │    │
│  │  - 接收用户需求                                      │    │
│  │  - 分配任务给对应 Agent                              │    │
│  │  - 协调 Agent 之间的通信                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ PM Agent │  │Dev Agent │  │Review    │                   │
│  │          │  │          │  │Agent     │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
│       │             │             │                          │
│       └─────────────┴─────────────┘                          │
│                     │                                        │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              LLM Provider (OpenAI/GLM)               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Execution Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ File System │  │ Git         │  │ Code Runner         │  │
│  │ (代码仓库)   │  │ (版本控制)   │  │ (安全执行环境)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心模块

### 1. Agent 系统 (`/src/lib/agents/`)

```typescript
// 基础 Agent 接口
interface Agent {
  id: string
  name: string
  role: 'pm' | 'dev' | 'review'
  execute(task: Task): Promise<AgentResponse>
}

// PM Agent: 分析需求、拆分任务
class PMAgent implements Agent {
  async execute(task: Task): Promise<AgentResponse> {
    // 1. 分析用户需求
    // 2. 生成任务列表
    // 3. 分配给 Dev Agent
  }
}

// Dev Agent: 编写代码
class DevAgent implements Agent {
  async execute(task: Task): Promise<AgentResponse> {
    // 1. 理解任务需求
    // 2. 生成/修改代码
    // 3. 提交给 Review Agent
  }
}

// Review Agent: 代码审查
class ReviewAgent implements Agent {
  async execute(task: Task): Promise<AgentResponse> {
    // 1. 检查代码质量
    // 2. 提出改进建议
    // 3. 批准或拒绝
  }
}
```

### 2. 任务系统 (`/src/lib/tasks/`)

```typescript
interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'review' | 'done'
  assignedTo: AgentRole
  dependencies: string[]
  files: string[]
  createdAt: Date
  updatedAt: Date
}

class TaskManager {
  createTask(description: string): Task
  assignTask(taskId: string, agent: AgentRole): void
  updateStatus(taskId: string, status: TaskStatus): void
  getTaskHistory(): Task[]
}
```

### 3. 对话系统 (`/src/lib/chat/`)

```typescript
interface Message {
  id: string
  agent: 'user' | 'pm' | 'dev' | 'review'
  content: string
  type: 'text' | 'code' | 'file' | 'task'
  timestamp: Date
}

class ChatManager {
  addMessage(message: Message): void
  getHistory(): Message[]
  broadcast(agent: AgentRole, content: string): void
}
```

### 4. 文件系统 (`/src/lib/filesystem/`)

```typescript
class FileSystemManager {
  readFile(path: string): string
  writeFile(path: string, content: string): void
  listFiles(dir: string): string[]
  createDirectory(path: string): void
}
```

### 5. LLM 集成 (`/src/lib/llm/`)

```typescript
interface LLMProvider {
  chat(messages: Message[]): Promise<string>
  stream(messages: Message[]): AsyncGenerator<string>
}

class OpenAIProvider implements LLMProvider {
  // GPT-4 / GPT-4o
}

class GLMProvider implements LLMProvider {
  // 智谱 GLM-4
}
```

---

## API 设计

### POST /api/chat
发送消息到团队聊天

```typescript
Request: {
  message: string
  context?: {
    currentProject?: string
    activeTask?: string
  }
}

Response: {
  messages: Message[]
  tasks?: Task[]
  files?: FileChange[]
}
```

### GET /api/tasks
获取任务列表

```typescript
Response: {
  tasks: Task[]
  stats: {
    total: number
    completed: number
    inProgress: number
  }
}
```

### POST /api/agent/execute
手动触发 Agent 执行

```typescript
Request: {
  agent: 'pm' | 'dev' | 'review'
  task: string
}

Response: {
  result: AgentResponse
  nextActions: string[]
}
```

---

## 数据流

### 场景：用户发起一个需求

```
1. 用户: "帮我创建一个用户登录页面"
   │
   ▼
2. PM Agent 分析需求
   - 生成任务列表
   - 任务1: 创建登录表单组件
   - 任务2: 添加表单验证
   - 任务3: 实现登录 API
   │
   ▼
3. PM Agent 分配任务1给 Dev Agent
   │
   ▼
4. Dev Agent 编写代码
   - 创建 LoginForm.tsx
   - 添加样式
   │
   ▼
5. Dev Agent 提交给 Review Agent
   │
   ▼
6. Review Agent 审查代码
   - 检查安全性
   - 检查可访问性
   - 提出改进建议
   │
   ▼
7. Dev Agent 根据反馈修改
   │
   ▼
8. Review Agent 批准
   │
   ▼
9. PM Agent 标记任务完成
   │
   ▼
10. 系统提交代码到 Git
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| Frontend | Next.js 14, React, Tailwind, Framer Motion |
| Backend | Next.js API Routes |
| Agent | 自定义 Agent 框架 |
| LLM | OpenAI API / 智谱 GLM |
| Storage | SQLite / JSON 文件 |
| Execution | Docker / Node.js VM |

---

## 开发计划

### Phase 1: 核心框架 (Day 1 - 今天)
- [x] 项目初始化
- [x] Landing Page
- [x] Demo Chat UI
- [x] 测试框架
- [x] Agent 基础类
- [x] Task Manager
- [x] Chat Manager
- [x] API 路由
- [ ] Agent 测试用例
- [ ] 前端集成
- [ ] README

### Phase 2: LLM 集成 (Day 2)
- [ ] OpenAI API 集成
- [ ] Agent Prompt 设计
- [ ] 对话流程实现
- [ ] 真实对话演示

### Phase 3: 执行能力 (Day 3)
- [ ] 文件系统操作
- [ ] Git 集成
- [ ] 代码执行沙箱
- [ ] 完整工作流演示

### Phase 4: 文档和提交 (Day 4)
- [ ] 项目说明书
- [ ] 演示视频
- [ ] 项目海报
- [ ] 最终提交

---

## 下一步行动

1. **立即**: 实现 Agent 基础类
2. **今天**: 完成 Task Manager + Chat Manager
3. **明天**: LLM 集成 + 真实对话

---

*最后更新: 2026-03-15 17:40*
