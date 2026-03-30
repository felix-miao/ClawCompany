# ClawCompany Multi-Agent 协作系统 - 最终实施方案

**版本：** v4.0 Final
**创建时间：** 2026-03-24 13:20
**状态：** 已验证，可直接实施
**基于：** OpenClaw 技术栈深度调研 + Edict 项目验证

---

## 📋 调研总结

### 核心发现

**1. OpenClaw Agent 机制**
- ✅ `openclaw agents add` 创建完全独立的 agent
- ✅ 每个 agent 有独立的 workspace
- ✅ workspace 中包含 SOUL.md、MEMORY.md 等
- ✅ 通过 openclaw.json 的 `agents.list` 配置

**2. Agent 间通信**
- ✅ 通过 `subagents.allowAgents` 配置权限
- ✅ Agent 可以在 SOUL.md 中使用 sessions_spawn 调用其他 agents
- ✅ 权限控制：只有在 allowAgents 列表中的 agent 才能被调用

**3. 数据共享**
- ✅ 使用软链接共享 data 目录（Edict 验证可行）
- ✅ 所有 agents 读写同一份 tasks.json

**4. 消息路由**
- ✅ 通过 bindings 可以将特定 channel 绑定到特定 agent
- ✅ Main agent 可以作为 Router（在 SOUL.md 中判断并调用其他 agents）

---

## 🏗️ 系统架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户（Telegram/Feishu）                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  OpenClaw Gateway                            │
│  - 接收用户消息                                              │
│  - 根据 bindings 路由                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│         Main Agent (Router)                                  │
│  Workspace: ~/.openclaw/workspace                            │
│  SOUL.md: 消息分拣规则                                        │
│                                                               │
│  功能：                                                       │
│  1. 接收所有用户消息                                          │
│  2. 判断：闲聊 vs 工作任务                                    │
│  3. 闲聊 → 直接回复                                           │
│  4. 工作任务 → 调用 PM Agent                                  │
│                                                               │
│  权限：                                                       │
│  allowAgents: ["pm-agent", "reviewer-agent"]                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ sessions_spawn
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            PM Agent (Project Manager)                        │
│  Workspace: ~/.openclaw/agents/pm-agent                      │
│  SOUL.md: PM 角色定义                                         │
│  MEMORY.md: PM 长期记忆                                       │
│  data/ → ~/.openclaw/shared-data (软链接)                    │
│                                                               │
│  功能：                                                       │
│  1. 分析需求                                                  │
│  2. 制定方案                                                  │
│  3. 调用 Developer Agent                                      │
│                                                               │
│  权限：                                                       │
│  allowAgents: ["developer-agent", "tester-agent"]            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ sessions_spawn
                       ↓
┌─────────────────────────────────────────────────────────────┐
│         Developer Agent (Implementer)                        │
│  Workspace: ~/.openclaw/agents/developer-agent               │
│  data/ → ~/.openclaw/shared-data (软链接)                    │
│                                                               │
│  功能：                                                       │
│  1. 实现代码                                                  │
│  2. 调用 Tester Agent                                         │
│                                                               │
│  权限：                                                       │
│  allowAgents: ["tester-agent"]                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ sessions_spawn
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            Tester Agent (Validator)                          │
│  Workspace: ~/.openclaw/agents/tester-agent                  │
│  data/ → ~/.openclaw/shared-data (软链接)                    │
│                                                               │
│  功能：                                                       │
│  1. 执行测试                                                  │
│  2. 返回结果                                                  │
│                                                               │
│  权限：                                                       │
│  allowAgents: ["pm-agent"]  // 返回结果                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ sessions_spawn
                       ↓
┌─────────────────────────────────────────────────────────────┐
│            Reviewer Agent (Auditor)                          │
│  Workspace: ~/.openclaw/agents/reviewer-agent                │
│  data/ → ~/.openclaw/shared-data (软链接)                    │
│                                                               │
│  功能：                                                       │
│  1. 审核最终结果                                              │
│  2. Approve → 发送给用户                                      │
│  3. Reject → 返工                                             │
│                                                               │
│  权限：                                                       │
│  allowAgents: ["pm-agent"]  // 返工                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ openclaw message send
                       ↓
                   用户
```

---

## 🔧 详细实施步骤

### Step 1: 创建 Agents（5 分钟）

```bash
# 1. 创建 PM Agent
openclaw agents add pm-agent \
  --workspace ~/.openclaw/agents/pm-agent \
  --model zai/glm-5

# 2. 创建 Developer Agent
openclaw agents add developer-agent \
  --workspace ~/.openclaw/agents/developer-agent \
  --model zai/glm-5

# 3. 创建 Tester Agent
openclaw agents add tester-agent \
  --workspace ~/.openclaw/agents/tester-agent \
  --model zai/glm-5

# 4. 创建 Reviewer Agent
openclaw agents add reviewer-agent \
  --workspace ~/.openclaw/agents/reviewer-agent \
  --model zai/glm-5
```

---

### Step 2: 配置权限（10 分钟）

**编辑 `~/.openclaw/openclaw.json`：**

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "workspace": "~/.openclaw/workspace",
        "subagents": {
          "allowAgents": ["pm-agent", "reviewer-agent"]
        }
      },
      {
        "id": "pm-agent",
        "workspace": "~/.openclaw/agents/pm-agent",
        "subagents": {
          "allowAgents": ["developer-agent", "tester-agent"]
        }
      },
      {
        "id": "developer-agent",
        "workspace": "~/.openclaw/agents/developer-agent",
        "subagents": {
          "allowAgents": ["tester-agent"]
        }
      },
      {
        "id": "tester-agent",
        "workspace": "~/.openclaw/agents/tester-agent",
        "subagents": {
          "allowAgents": ["pm-agent"]
        }
      },
      {
        "id": "reviewer-agent",
        "workspace": "~/.openclaw/agents/reviewer-agent",
        "subagents": {
          "allowAgents": ["pm-agent"]
        }
      }
    ]
  }
}
```

---

### Step 3: 创建共享数据目录（5 分钟）

```bash
# 1. 创建共享数据目录
mkdir -p ~/.openclaw/shared-data

# 2. 初始化 tasks.json
cat > ~/.openclaw/shared-data/tasks.json << 'EOF'
{
  "tasks": []
}
EOF

# 3. 为每个 agent 创建软链接
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/pm-agent/data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/developer-agent/data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/tester-agent/data
ln -s ~/.openclaw/shared-data ~/.openclaw/agents/reviewer-agent/data
```

---

### Step 4: 编写 SOUL.md（30 分钟）

#### Main Agent SOUL.md

```bash
cat > ~/.openclaw/workspace/SOUL.md << 'EOF'
# Main Agent - 消息路由器

你是 ClawCompany 的消息路由器。

## 消息分拣规则

### 直接回复：
- 简短回复：「好」「否」「?」
- 闲聊/问答
- 信息查询

### 创建任务：
- 工作指令：「帮我实现 XX」
- 具体目标（≥10 字）

## 工作流程

### 收到工作任务后：

1. 回复用户："已收到，正在处理..."

2. 调用 PM Agent：
```json
{
  "tool": "sessions_spawn",
  "agent": "pm-agent",
  "message": "用户需求：..."
}
```

3. 等待完成

4. 调用 Reviewer Agent 审核

5. 发送给用户
EOF
```

#### PM Agent SOUL.md

```bash
cat > ~/.openclaw/agents/pm-agent/SOUL.md << 'EOF'
# PM Agent - 项目经理

你是 ClawCompany 的项目经理。

## 职责

1. 分析需求
2. 制定方案（3-5 步）
3. 调用 Developer Agent

## 工作流程

### 收到需求后：

1. 分析需求
2. 制定方案
3. 调用 Developer：
```json
{
  "tool": "sessions_spawn",
  "agent": "developer-agent",
  "message": "任务：...\n方案：..."
}
```

4. 返回结果

## 数据记录

更新 tasks.json（通过 data/tasks.json）：
```json
{
  "id": "TASK-001",
  "status": "in_progress",
  "currentAgent": "developer-agent"
}
```
EOF
```

#### Developer Agent SOUL.md

```bash
cat > ~/.openclaw/agents/developer-agent/SOUL.md << 'EOF'
# Developer Agent - 开发工程师

你是 ClawCompany 的开发工程师。

## 职责

1. 实现代码
2. 调用 Tester Agent

## 工作流程

### 收到任务后：

1. 实现代码
2. 调用 Tester：
```json
{
  "tool": "sessions_spawn",
  "agent": "tester-agent",
  "message": "代码已完成，请测试"
}
```
EOF
```

#### Tester Agent SOUL.md

```bash
cat > ~/.openclaw/agents/tester-agent/SOUL.md << 'EOF'
# Tester Agent - 测试工程师

你是 ClawCompany 的测试工程师。

## 职责

1. 执行测试
2. 返回结果

## 工作流程

### 收到代码后：

1. 执行测试
2. 返回结果：
```json
{
  "tool": "sessions_spawn",
  "agent": "pm-agent",
  "message": "测试完成，结果：..."
}
```
EOF
```

#### Reviewer Agent SOUL.md

```bash
cat > ~/.openclaw/agents/reviewer-agent/SOUL.md << 'EOF'
# Reviewer Agent - 审核官

你是 ClawCompany 的审核官。

## 审核标准

1. ✅ 需求是否满足
2. ✅ 质量是否达标
3. ✅ 是否有遗漏

## 审核流程

### 收到审核请求后：

1. 检查结果
2. 决定：Approve 或 Reject

### Approve：
返回给 main agent，发送给用户

### Reject：
```json
{
  "tool": "sessions_spawn",
  "agent": "pm-agent",
  "message": "需要修改：..."
}
```
EOF
```

---

### Step 5: 重启 Gateway（2 分钟）

```bash
# 重启 Gateway 使配置生效
openclaw gateway restart

# 验证 agents
openclaw agents list
```

---

## 📊 数据结构

### tasks.json

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

## ✅ 验证清单

### Agent 创建验证

```bash
# 检查 agents 是否创建成功
openclaw agents list

# 预期输出：
# - main (default)
# - pm-agent
# - developer-agent
# - tester-agent
# - reviewer-agent
```

### 权限验证

```bash
# 检查配置
cat ~/.openclaw/openclaw.json | grep allowAgents

# 预期：每个 agent 都有 allowAgents 配置
```

### 软链接验证

```bash
# 检查软链接
ls -la ~/.openclaw/agents/*/data

# 预期：所有 data 都指向 ~/.openclaw/shared-data
```

### SOUL.md 验证

```bash
# 检查 SOUL.md
ls -la ~/.openclaw/agents/*/SOUL.md

# 预期：每个 agent 都有 SOUL.md
```

---

## 🚀 使用示例

### 用户发送任务

```
用户：帮我实现用户登录功能
```

### 系统流程

```
1. Main Agent 收到消息
2. 判断是工作任务
3. 调用 PM Agent
   
4. PM Agent 分析需求
5. 制定方案
6. 调用 Developer Agent
   
7. Developer Agent 实现代码
8. 调用 Tester Agent
   
9. Tester Agent 测试
10. 返回结果给 PM Agent
    
11. PM Agent 调用 Reviewer Agent
12. Reviewer Agent 审核
    
13. Approve → 发送给用户
```

---

## 📁 文件结构

```
~/.openclaw/
  ├── workspace/                    # Main Agent
  │   └── SOUL.md
  │
  ├── agents/
  │   ├── pm-agent/
  │   │   ├── SOUL.md
  │   │   ├── MEMORY.md
  │   │   └── data/ → ~/.openclaw/shared-data
  │   │
  │   ├── developer-agent/
  │   │   ├── SOUL.md
  │   │   └── data/ → ~/.openclaw/shared-data
  │   │
  │   ├── tester-agent/
  │   │   ├── SOUL.md
  │   │   └── data/ → ~/.openclaw/shared-data
  │   │
  │   └── reviewer-agent/
  │       ├── SOUL.md
  │       └── data/ → ~/.openclaw/shared-data
  │
  ├── shared-data/
  │   └── tasks.json
  │
  └── openclaw.json                 # 配置文件
```

---

## ⚖️ Tradeoff 结论

### 审核机制

**方案：** 只在最终结果返回用户前审核

**理由：**
- ✅ 简单清晰
- ✅ 质量有保障
- ✅ 避免中间环节审核

**成本：** +3-5 分钟
**结论：** ✅ 值得

---

## 🎯 总结

### 核心技术

1. **独立 Agents** - `openclaw agents add` 创建
2. **权限控制** - `allowAgents` 配置
3. **Agent 通信** - `sessions_spawn` 调用
4. **数据共享** - 软链接方案

### 实施时间

- **总计：** ~1 小时
- Step 1: 5 分钟
- Step 2: 10 分钟
- Step 3: 5 分钟
- Step 4: 30 分钟
- Step 5: 2 分钟
- 验证：8 分钟

### 可靠性

- ✅ 基于 Edict 验证过的方案
- ✅ 所有技术点已验证
- ✅ 可直接按文档实施

---

**方案已完成，可直接实施！** 🚀

---

*版本: v4.0 Final*
*创建时间: 2026-03-24 13:20*
*状态: 已验证*
