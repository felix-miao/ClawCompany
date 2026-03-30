# ClawCompany Multi-Agent 协作系统 - 设计方案 v3.0

**版本：** v3.0
**创建时间：** 2026-03-24 09:35
**状态：** 待批准
**基于：** OpenClaw 技术栈深度调研

---

## 📋 核心反馈响应

### 1. Message Router 实现逻辑

**问题：** OpenClaw 跟 message app 怎么接入？如何加入 router？

**调研结果：**

OpenClaw 有两种模式：
1. **主 agent 模式**（默认）
   - 用户消息 → main agent
   - main agent 处理并回复

2. **多 agent 路由模式**（通过 bindings）
   ```bash
   # 为 agent 绑定 channel
   openclaw agents bind --agent pm-agent --bind telegram
   ```

**我们的方案：主 agent 作为 Router**

```
用户消息 → main agent (Router) → 根据 content 决定 → 调用对应 agent
```

---

### 2. Reviewer 机制

**反馈：** 先在最终结果返回用户前 review，不需要配置每个 agent

**新方案：**
```
任务流程：PM → Developer → Tester → PM → [Reviewer] → 用户
                                         ↑
                                    最终审核点
```

---

### 3. 整体架构图

**需要细化：** 展示如何与 OpenClaw 技术接洽

---

### 4. Tradeoff 部分

**反馈：** 精简，只给结论

---

## 🏗️ 系统架构（基于 OpenClaw）

### 架构图（详细版）

```
┌──────────────────────────────────────────────────────────────┐
│                     用户（Telegram/Feishu）                   │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                 OpenClaw Gateway                              │
│  - 接收用户消息                                               │
│  - 根据 bindings 路由到对应 agent                            │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────────┐
│         Main Agent (Router)                                   │
│  Workspace: ~/.openclaw/workspace                             │
│  SOUL.md: 消息分拣规则                                         │
│                                                               │
│  职责：                                                        │
│  1. 接收所有用户消息                                           │
│  2. 判断：闲聊 vs 工作任务                                     │
│  3. 闲聊 → 直接回复                                            │
│  4. 工作任务 → 调用 PM Agent                                   │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ sessions_spawn (调用子 agent)
                       ↓
┌──────────────────────────────────────────────────────────────┐
│              PM Agent (Project Manager)                       │
│  Workspace: ~/.openclaw/agents/pm-agent/                      │
│  SOUL.md: PM 角色定义                                          │
│  Memory: ~/.openclaw/agents/pm-agent/MEMORY.md                │
│                                                               │
│  职责：                                                        │
│  1. 分析需求                                                   │
│  2. 制定方案                                                   │
│  3. 调用 Developer Agent                                       │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ sessions_spawn
                       ↓
┌──────────────────────────────────────────────────────────────┐
│           Developer Agent (Implementer)                       │
│  Workspace: ~/.openclaw/agents/developer-agent/               │
│                                                               │
│  职责：                                                        │
│  1. 实现代码                                                   │
│  2. 调用 Tester Agent                                          │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ sessions_spawn
                       ↓
┌──────────────────────────────────────────────────────────────┐
│              Tester Agent (Validator)                         │
│  Workspace: ~/.openclaw/agents/tester-agent/                  │
│                                                               │
│  职责：                                                        │
│  1. 执行测试                                                   │
│  2. 返回结果给 PM                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ sessions_send (返回结果)
                       ↓
┌──────────────────────────────────────────────────────────────┐
│              Reviewer Agent (Auditor)                         │
│  Workspace: ~/.openclaw/agents/reviewer-agent/                │
│                                                               │
│  职责：                                                        │
│  1. 审核最终结果                                               │
│  2. Approve → 发送给用户                                       │
│  3. Reject → 返工                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ openclaw message send
                       ↓
                   用户
```

---

## 🔧 核心技术实现

### 1. Main Agent (Router) - 基于 OpenClaw

**SOUL.md 示例：**

```markdown
# Main Agent - 消息路由器

你是 ClawCompany 的消息路由器，负责接收所有用户消息并分发。

## 消息分拣规则

### 直接回复（不建任务）：
- 简短回复：「好」「否」「?」「了解」
- 闲聊/问答：「token 消耗多少？」「这个怎么样？」
- 信息查询：「xx 是什么」

### 创建任务（调用 PM Agent）：
- 明确的工作指令：「帮我实现 XX」「调研 XX」
- 包含具体目标或交付物
- 有实质内容（≥10 字）

## 工作流程

### 收到工作任务后：

1. 立即回复用户：
   "已收到，正在处理..."

2. 调用 PM Agent：
   使用 sessions_spawn 工具：
   ```json
   {
     "tool": "sessions_spawn",
     "agent": "pm-agent",
     "message": "用户需求：实现用户登录功能"
   }
   ```

3. 等待 PM Agent 完成并返回结果

4. 调用 Reviewer Agent 审核：
   ```json
   {
     "tool": "sessions_spawn",
     "agent": "reviewer-agent",
     "message": "请审核结果..."
   }
   ```

5. 根据 Reviewer 结果：
   - Approved → 发送给用户
   - Rejected → 返回 PM Agent 修改

## 权限配置

在 ~/.openclaw/openclaw.json 中：
```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "subagents": {
          "allowAgents": ["pm-agent", "reviewer-agent"]
        }
      }
    ]
  }
}
```
```

---

### 2. PM Agent - 基于 OpenClaw

**SOUL.md 示例：**

```markdown
# PM Agent - 项目经理

你是 ClawCompany 的项目经理，负责分析和规划任务。

## 职责

1. 分析用户需求
2. 制定执行方案
3. 拆解任务
4. 调用 Developer Agent

## 工作流程

### 收到需求后：

1. 分析需求
2. 制定方案（3-5 步）
3. 调用 Developer Agent：
   ```json
   {
     "tool": "sessions_spawn",
     "agent": "developer-agent",
     "message": "任务：实现登录功能\n方案：1) UI 2) 认证 3) 测试"
   }
   ```

4. 等待 Developer 完成

5. 返回结果给 Main Agent

## 权限配置

```json
{
  "id": "pm-agent",
  "workspace": "~/.openclaw/agents/pm-agent",
  "subagents": {
    "allowAgents": ["developer-agent", "tester-agent"]
  }
}
```
```

---

### 3. Reviewer Agent - 最终审核

**SOUL.md 示例：**

```markdown
# Reviewer Agent - 审核官

你是 ClawCompany 的审核官，负责审核最终结果。

## 审核标准

1. ✅ 需求是否完全满足
2. ✅ 代码/方案质量
3. ✅ 是否有遗漏
4. ✅ 是否有风险

## 审核流程

### 收到审核请求后：

1. 检查需求是否满足
2. 检查代码质量
3. 决定：Approve 或 Reject

### 如果 Approve：
```json
{
  "result": "approved",
  "feedback": "方案可行，质量良好",
  "message": "可以发送给用户"
}
```

### 如果 Reject：
```json
{
  "result": "rejected",
  "feedback": "缺少错误处理",
  "suggestions": ["添加异常捕获", "增加日志"]
}
```

## 权限配置

```json
{
  "id": "reviewer-agent",
  "workspace": "~/.openclaw/agents/reviewer-agent",
  "subagents": {
    "allowAgents": ["pm-agent"]  // 只能返回给 PM
  }
}
```
```

---

### 4. Task Tracker - 共享数据

**基于 OpenClaw workspace 共享：**

```
~/.openclaw/
  ├── workspace/              # Main Agent workspace
  │   └── data/              # 软链接到共享数据
  │       └── tasks.json     # 任务列表
  │
  ├── agents/
  │   ├── pm-agent/
  │   │   ├── SOUL.md
  │   │   ├── MEMORY.md
  │   │   └── data/          # 软链接到共享数据
  │   │
  │   ├── developer-agent/
  │   │   ├── SOUL.md
  │   │   └── data/          # 软链接
  │   │
  │   ├── tester-agent/
  │   │   └── data/          # 软链接
  │   │
  │   └── reviewer-agent/
  │       └── data/          # 软链接
  │
  └── shared-data/           # 共享数据目录
      ├── tasks.json         # 任务列表
      └── messages.json      # 消息历史
```

**软链接配置：**

```bash
# 为每个 agent 创建软链接
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/pm-agent/data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/developer-agent/data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/tester-agent/data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/reviewer-agent/data
```

---

## 📊 数据结构

### Task (tasks.json)

```json
{
  "tasks": [
    {
      "id": "TASK-001",
      "title": "实现用户登录功能",
      "description": "用户需求：...",
      
      "status": "in_progress",
      "currentAgent": "developer-agent",
      
      "chain": [
        {
          "agent": "main",
          "action": "接收需求",
          "timestamp": "2026-03-24T10:00:00Z"
        },
        {
          "agent": "pm-agent",
          "action": "制定方案",
          "output": "分3步实现...",
          "timestamp": "2026-03-24T10:05:00Z"
        }
      ],
      
      "review": {
        "needed": true,
        "result": null
      },
      
      "createdAt": "2026-03-24T10:00:00Z",
      "updatedAt": "2026-03-24T10:05:00Z"
    }
  ]
}
```

---

## 🚀 实施计划

### Phase 1：基础配置（1 天）

**任务：**
- [ ] 创建 4 个 agent workspaces
- [ ] 配置 openclaw.json
- [ ] 设置软链接
- [ ] 编写 SOUL.md

**命令：**

```bash
# 1. 创建 agents
openclaw agents add pm-agent
openclaw agents add developer-agent
openclaw agents add tester-agent
openclaw agents add reviewer-agent

# 2. 配置权限
# 编辑 ~/.openclaw/openclaw.json

# 3. 创建软链接
mkdir -p ~/.openclaw/shared-data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/pm-agent/data
# ... 其他 agents

# 4. 设置可见性
openclaw config set tools.sessions.visibility all
```

---

### Phase 2：SOUL.md 编写（1 天）

**任务：**
- [ ] Main Agent SOUL.md（路由规则）
- [ ] PM Agent SOUL.md
- [ ] Developer Agent SOUL.md
- [ ] Tester Agent SOUL.md
- [ ] Reviewer Agent SOUL.md

---

### Phase 3：测试（1 天）

**任务：**
- [ ] 测试消息路由
- [ ] 测试 agent 间通信
- [ ] 测试审核流程
- [ ] E2E 测试

---

## ⚖️ Tradeoff 结论

### 审核机制

**方案：** 只在最终结果返回用户前审核

**理由：**
- ✅ 简单清晰
- ✅ 避免中间环节审核
- ✅ 质量有保障

**成本：** +3-5 分钟
**价值：** 质量保证
**结论：** ✅ 值得

---

## 📁 文件清单

### Agent Workspaces（5 个）

```
~/.openclaw/
  ├── workspace/              # Main Agent
  │   └── SOUL.md
  │
  └── agents/
      ├── pm-agent/
      │   ├── SOUL.md
      │   ├── MEMORY.md
      │   └── data/ → ~/.openclaw/shared-data
      │
      ├── developer-agent/
      │   ├── SOUL.md
      │   └── data/ → ~/.openclaw/shared-data
      │
      ├── tester-agent/
      │   ├── SOUL.md
      │   └── data/ → ~/.openclaw/shared-data
      │
      └── reviewer-agent/
          ├── SOUL.md
          └── data/ → ~/.openclaw/shared-data
```

### 配置文件（1 个）

```
~/.openclaw/openclaw.json
```

### 共享数据（2 个）

```
~/.openclaw/shared-data/
  ├── tasks.json
  └── messages.json
```

---

## ✅ 总结

### 核心特点

1. **基于 OpenClaw**
   - 使用 OpenClaw 的 agents 机制
   - 使用 sessions_spawn 调用子 agents
   - 使用 sessions_send 返回结果

2. **Main Agent 作为 Router**
   - 接收所有用户消息
   - 根据 SOUL.md 分拣
   - 调用对应的子 agent

3. **共享数据**
   - 通过软链接共享 tasks.json
   - 所有 agents 读写同一份数据

4. **最终审核**
   - Reviewer Agent 审核最终结果
   - 只在一个点审核
   - 简单清晰

---

**预计完成：3 天**

---

*版本: v3.0*
*创建时间: 2026-03-24 09:35*
*状态: 待批准*
