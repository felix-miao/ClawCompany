# ClawCompany 真实实现计划

## 🎯 目标

将 ClawCompany 从 Demo 升级为**真实的 OpenClaw Skill**，可以作为 ClawHub plugin 发布和使用。

---

## 📊 当前状态 vs 目标状态

| 项目 | 当前（Demo） | 目标（真实） |
|------|-------------|-------------|
| **Orchestrator** | 自定义类 | **OpenClaw 本身** |
| **PM Agent** | 自定义类 + GLM-5 | **sessions_spawn (subagent)** |
| **Dev Agent** | 硬编码模板 | **sessions_spawn (acp, opencode)** |
| **Review Agent** | 随机检查 | **sessions_spawn (subagent)** |
| **文件保存** | 有框架 | **OpenClaw read/write 工具** |
| **消息系统** | 自定义 | **sessions_send** |
| **发布方式** | GitHub repo | **ClawHub Skill** |

---

## 🏗️ 真实架构设计

### 目录结构

```
ClawCompany/
├── ai-team-demo/           # Demo 版本（保留）
│   └── ...
├── skill/                  # 真实版本（新增）⭐
│   ├── SKILL.md           # Skill 描述（必需）
│   ├── package.json       # Skill 元数据
│   ├── src/
│   │   ├── index.ts       # 主入口
│   │   ├── orchestrator.ts # OpenClaw orchestrator
│   │   ├── agents/
│   │   │   ├── pm-agent.ts
│   │   │   ├── dev-agent.ts
│   │   │   └── review-agent.ts
│   │   └── utils/
│   │       ├── file-manager.ts
│   │       └── task-manager.ts
│   ├── examples/          # 使用示例
│   │   ├── simple-project.md
│   │   └── web-app.md
│   └── tests/             # 测试
│       └── orchestrator.test.ts
├── docs/                   # 文档
│   ├── ARCHITECTURE-v2.md # 架构设计
│   ├── REAL-IMPLEMENTATION.md # 真实实现说明（新增）
│   └── ...
└── README.md
```

---

## 🔧 核心实现

### 1. SKILL.md（Skill 描述）

```markdown
# ClawCompany - AI 虚拟团队协作系统

## 描述

通过 OpenClaw 组建 AI 虚拟团队，实现一人企业家的工作模式。

## 使用场景

- 快速原型开发
- 自动化代码生成
- AI 团队协作演示
- 项目脚手架生成

## 使用方法

在 OpenClaw 中：

用户：帮我创建一个登录页面
OpenClaw：（使用 ClawCompany skill）
  - PM Agent 分析需求
  - Dev Agent 生成代码
  - Review Agent 审查质量
  - 返回完整项目

## 配置

需要配置 GLM API Key：
- GLM_API_KEY: 你的 GLM API key
- GLM_MODEL: glm-5（推荐）
```

### 2. Orchestrator（核心协调器）

```typescript
// src/orchestrator.ts

import { sessions_spawn, sessions_history, sessions_send } from 'openclaw'

export class ClawCompanyOrchestrator {
  /**
   * 执行用户需求
   */
  async execute(userRequest: string, projectPath: string) {
    // 1. Spawn PM Agent
    const pmSession = await this.spawnPMAgent(userRequest)
    const tasks = await this.getPMResult(pmSession)

    // 2. 按顺序执行每个任务
    const results = []
    for (const task of tasks) {
      // 2.1 Spawn Dev Agent
      const devSession = await this.spawnDevAgent(task, projectPath)
      const devResult = await this.getDevResult(devSession)

      // 2.2 Spawn Review Agent
      const reviewSession = await this.spawnReviewAgent(task, devResult)
      const reviewResult = await this.getReviewResult(reviewSession)

      // 2.3 如果不通过，重新执行
      if (!reviewResult.approved) {
        // TODO: 重新执行或通知用户
      }

      results.push({
        task,
        files: devResult.files,
        review: reviewResult
      })
    }

    return {
      success: true,
      tasks,
      results,
      summary: `完成了 ${tasks.length} 个任务`
    }
  }

  /**
   * Spawn PM Agent
   */
  private async spawnPMAgent(userRequest: string) {
    return await sessions_spawn({
      runtime: "subagent",
      task: `你是 PM Agent (产品经理)。

用户需求：${userRequest}

你的职责：
1. 分析用户需求
2. 拆分成可执行的子任务
3. 为每个任务指定负责人 (dev)
4. 设置任务依赖关系

返回格式 (JSON):
{
  "analysis": "需求分析...",
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "任务描述",
      "assignedTo": "dev",
      "dependencies": []
    }
  ]
}`,
      thinking: "high",
      mode: "run"
    })
  }

  /**
   * Spawn Dev Agent (OpenCode)
   */
  private async spawnDevAgent(task: any, projectPath: string) {
    return await sessions_spawn({
      runtime: "acp",
      agentId: "opencode",
      task: `你是 Dev Agent (开发者)。

任务：${task.title}
描述：${task.description}

你的职责：
1. 实现这个功能
2. 创建/修改代码文件
3. 确保代码可运行

要求：
- 使用 TypeScript
- 遵循最佳实践
- 添加必要的注释`,
      mode: "run",
      cwd: projectPath
    })
  }

  /**
   * Spawn Review Agent
   */
  private async spawnReviewAgent(task: any, devResult: any) {
    return await sessions_spawn({
      runtime: "subagent",
      task: `你是 Review Agent (代码审查)。

任务：${task.title}
Dev Agent 的实现：
${JSON.stringify(devResult, null, 2)}

你的职责：
1. 检查代码质量
2. 安全性审查
3. 性能优化建议
4. 提出改进建议

审查清单：
- ✅ 代码风格
- ✅ TypeScript 类型安全
- ✅ 错误处理
- ✅ 可访问性 (a11y)
- ✅ 性能优化
- ✅ 安全性检查
- ✅ 测试覆盖

返回格式 (JSON):
{
  "approved": true/false,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"],
  "summary": "审查总结"
}`,
      thinking: "high",
      mode: "run"
    })
  }

  /**
   * 获取 PM Agent 结果
   */
  private async getPMResult(session: any) {
    const history = await sessions_history({ sessionKey: session.sessionKey })
    const lastMessage = history.messages[history.messages.length - 1]
    return JSON.parse(lastMessage.content).tasks
  }

  /**
   * 获取 Dev Agent 结果
   */
  private async getDevResult(session: any) {
    const history = await sessions_history({ sessionKey: session.sessionKey })
    const lastMessage = history.messages[history.messages.length - 1]
    return JSON.parse(lastMessage.content)
  }

  /**
   * 获取 Review Agent 结果
   */
  private async getReviewResult(session: any) {
    const history = await sessions_history({ sessionKey: session.sessionKey })
    const lastMessage = history.messages[history.messages.length - 1]
    return JSON.parse(lastMessage.content)
  }
}
```

### 3. 主入口（index.ts）

```typescript
// src/index.ts

import { ClawCompanyOrchestrator } from './orchestrator'

export async function createProject(
  userRequest: string,
  projectPath: string = process.cwd()
) {
  const orchestrator = new ClawCompanyOrchestrator()
  return await orchestrator.execute(userRequest, projectPath)
}

export { ClawCompanyOrchestrator }
```

### 4. 使用示例

```typescript
// 在 OpenClaw 中使用
import { createProject } from 'clawcompany'

// 用户发送需求
const result = await createProject(
  "创建一个登录页面，包含邮箱和密码输入",
  "/path/to/project"
)

console.log(result.summary)
// 输出：完成了 3 个任务
```

---

## 📦 ClawHub 发布格式

### package.json

```json
{
  "name": "clawcompany",
  "version": "1.0.0",
  "description": "AI 虚拟团队协作系统 - 一人企业家，无限可能",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "keywords": [
    "openclaw",
    "ai-team",
    "automation",
    "code-generation"
  ],
  "author": "Felix Miao",
  "license": "MIT",
  "dependencies": {
    "openclaw": "latest"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "typescript": "^5.0.0"
  },
  "clawhub": {
    "category": "productivity",
    "tags": ["ai-team", "automation", "coding"],
    "icon": "🦞",
    "displayName": "ClawCompany",
    "description": "AI 虚拟团队协作系统"
  }
}
```

---

## 🚀 实现步骤

### Phase 1: 基础架构（2-3 小时）

- [x] 创建 skill/ 目录结构
- [x] 编写 SKILL.md
- [x] 创建 package.json
- [ ] 实现 orchestrator.ts（核心）
- [ ] 实现 agents/（PM/Dev/Review）

### Phase 2: OpenClaw 集成（2-3 小时）

- [ ] 集成 sessions_spawn
- [ ] 集成 sessions_history
- [ ] 集成 sessions_send
- [ ] 测试 subagent runtime
- [ ] 测试 acp runtime (OpenCode)

### Phase 3: 测试和文档（1-2 小时）

- [ ] 编写单元测试
- [ ] 编写使用示例
- [ ] 更新文档
- [ ] 准备 ClawHub 发布

---

## 📊 时间规划

**今天（3月16日）：**
- ✅ 创建目录结构
- ✅ 编写 SKILL.md 和 package.json
- ⏳ 实现核心 orchestrator
- ⏳ 实现 PM/Review Agent
- ⏳ 测试 OpenClaw 集成

**明天（3月17日）：**
- 实现 Dev Agent (OpenCode)
- 完整测试
- 准备发布

**后天（3月18日）：**
- 录制真实版本 demo
- 最终优化
- 提交比赛

---

## 🎯 交付物

1. **ClawHub Skill** - 可安装的 OpenClaw skill
2. **完整文档** - 使用说明 + API 文档
3. **测试** - 单元测试 + 集成测试
4. **Demo** - 真实版本的演示视频

---

## 💡 关键优势

**vs Demo 版本：**
- ✅ 真实的 OpenClaw 集成
- ✅ 真实的编码代理（OpenCode）
- ✅ 可作为 ClawHub plugin 发布
- ✅ 其他人可以直接使用
- ✅ 符合比赛要求（真实实现）

**vs 传统方式：**
- ✅ 利用 OpenClaw 能力，不重复造轮子
- ✅ 真实的 AI 团队协作
- ✅ 可扩展（添加更多 agent）
- ✅ 开源可用

---

*计划创建时间: 2026-03-16 10:15*
