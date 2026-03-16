# ClawCompany 项目说明书

## 项目基本信息

| 项目 | 内容 |
|------|------|
| **项目名称** | ClawCompany |
| **赛道** | 生产力龙虾 |
| **团队** | Felix Miao（一人团队） |
| **GitHub** | https://github.com/felix-miao/ClawCompany |
| **Demo** | http://localhost:3000 |
| **技术栈** | Next.js 14 + TypeScript + GLM-5 + OpenClaw |

---

## 1. 项目背景与动机

### 1.1 问题陈述

在现代软件开发中，一个人往往需要扮演多个角色：
- 产品经理（PM）：分析需求、规划任务
- 开发者（Dev）：编写代码、实现功能
- 审查员（Review）：检查代码、保证质量

**传统方式的痛点：**
- ⏰ 时间成本高：一个人需要在不同角色间切换
- 🔄 效率低下：任务管理和协调需要大量手动工作
- 😫 容易遗漏：缺乏系统性的流程管理

### 1.2 解决方案

**ClawCompany = OpenClaw + AI 虚拟团队**

通过 OpenClaw 的强大能力，自动组建一个由 AI Agent 构成的虚拟团队：
- 📋 **PM Agent**：智能分析需求，自动拆分任务
- 💻 **Dev Agent**：生成代码，实现功能
- 🔍 **Review Agent**：审查代码，保证质量

**核心价值：**
> **一人企业家，无限可能**
> 
> 一个人就能像拥有一支完整团队一样工作

---

## 2. 项目概述

### 2.1 核心概念

ClawCompany 是一个基于 OpenClaw 的 AI 虚拟团队协作系统，通过以下方式工作：

```
用户需求
    ↓
OpenClaw (Orchestrator)
    ↓
┌─────────────────────────┐
│  PM Agent               │  分析需求、拆分任务
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Dev Agent              │  生成代码、实现功能
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│  Review Agent           │  审查代码、保证质量
└─────────────────────────┘
    ↓
完成的项目
```

### 2.2 技术架构

**系统架构：**

```
┌─────────────────────────────────────────┐
│           Web Frontend (Next.js)         │
│  • Landing Page（展示概念）              │
│  • Demo Page（模拟演示）                 │
│  • Chat Page（真实交互）                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        OpenClaw (Orchestrator)           │
│  • 接收用户需求                          │
│  • Spawn PM/Dev/Review Agent            │
│  • 协调 Agent 协作                       │
│  • 返回结果给用户                        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│           Agent Layer                    │
│  • PM Agent (subagent)                  │
│  • Dev Agent (OpenCode)                 │
│  • Review Agent (subagent)              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Execution Layer                  │
│  • GLM-5 (LLM)                          │
│  • File System (保存代码)               │
│  • Git (版本控制)                        │
└─────────────────────────────────────────┘
```

---

## 3. 技术实现

### 3.1 核心技术栈

| 技术 | 用途 | 版本 |
|------|------|------|
| **Next.js** | Web 框架 | 14.2.35 |
| **TypeScript** | 类型安全 | 5.x |
| **Tailwind CSS** | 样式 | 3.x |
| **Framer Motion** | 动画 | 11.x |
| **GLM-5** | LLM 提供者 | glm-5 |
| **OpenClaw** | Agent 框架 | Latest |
| **Jest** | 测试框架 | 29.x |

### 3.2 项目结构

```
ClawCompany/
├── ai-team-demo/              # Next.js 项目
│   ├── src/
│   │   ├── app/              # App Router
│   │   │   ├── api/          # API 路由
│   │   │   ├── chat/         # 聊天页面
│   │   │   └── demo/         # 演示页面
│   │   ├── lib/              # 核心库
│   │   │   ├── agents/       # Agent 系统
│   │   │   ├── tasks/        # 任务管理
│   │   │   ├── chat/         # 对话管理
│   │   │   ├── llm/          # LLM 提供者
│   │   │   └── orchestrator/ # 协调器
│   │   └── components/       # React 组件
│   ├── public/               # 静态资源
│   └── package.json
├── docs/                      # 文档
│   ├── ARCHITECTURE-v2.md    # 架构设计
│   ├── DEMO-STORYBOARD.md    # Demo 分镜
│   └── PROJECT-DESCRIPTION.md # 本文档
└── README.md                  # 项目说明
```

### 3.3 关键实现

#### 3.3.1 Orchestrator（协调器）

```typescript
// OpenClaw 作为 Orchestrator
export async function orchestrate(userRequest: string) {
  // 1. Spawn PM Agent
  const pmAgent = await sessions_spawn({
    runtime: "subagent",
    task: `分析需求并拆分任务：${userRequest}`,
    thinking: "high"
  })

  // 2. 获取任务列表
  const tasks = await waitForCompletion(pmAgent)

  // 3. 按顺序执行每个任务
  for (const task of tasks) {
    // 3.1 Spawn Dev Agent
    const devAgent = await sessions_spawn({
      runtime: "acp",
      agentId: "opencode",
      task: `实现任务：${task.description}`,
      cwd: projectPath
    })

    // 3.2 Spawn Review Agent
    const reviewAgent = await sessions_spawn({
      runtime: "subagent",
      task: `审查代码：${task.title}`,
      thinking: "high"
    })

    // 3.3 根据审查结果决定下一步
    if (!reviewResult.approved) {
      // 重新实现
    }
  }

  return { tasks, files, messages }
}
```

#### 3.3.2 PM Agent（产品经理）

**职责：**
- 分析用户需求
- 拆分成可执行的子任务
- 分配任务给合适的 Agent
- 协调团队进度

**实现：**
```typescript
// 使用 GLM-5 进行智能分析
const pmAgent = await sessions_spawn({
  runtime: "subagent",
  task: `你是 PM Agent。
         分析需求：${userRequest}
         拆分成可执行的子任务。`,
  thinking: "high"
})
```

**示例输出：**
```
我已经分析了创建计算器的需求。
拆分为 3 个任务：

1. 界面构建 - 搭建 HTML/CSS 结构
2. 逻辑实现 - 编写 JS 计算逻辑
3. 审查测试 - 检查功能和性能
```

#### 3.3.3 Dev Agent（开发者）

**职责：**
- 理解任务需求
- 生成/修改代码
- 确保代码可运行
- 提交给 Review Agent

**实现：**
```typescript
// 使用真实的编码代理（OpenCode）
const devAgent = await sessions_spawn({
  runtime: "acp",
  agentId: "opencode",
  task: `实现任务：${task.description}`,
  cwd: projectPath
})
```

**示例输出：**
```
✅ 已创建文件：src/components/Calculator.tsx

实现内容：
- 加减乘除运算
- 清除和退格功能
- 响应式设计
```

#### 3.3.4 Review Agent（审查员）

**职责：**
- 检查代码质量
- 安全性审查
- 性能优化建议
- 批准或要求修改

**实现：**
```typescript
const reviewAgent = await sessions_spawn({
  runtime: "subagent",
  task: `审查代码质量、安全性、性能`,
  thinking: "high"
})
```

**审查清单：**
- ✅ 代码风格
- ✅ TypeScript 类型安全
- ✅ 错误处理
- ✅ 可访问性 (a11y)
- ✅ 性能优化
- ✅ 安全性检查
- ✅ 测试覆盖

---

## 4. 使用说明

### 4.1 快速开始

#### 安装依赖

```bash
cd ai-team-demo
npm install
```

#### 配置 GLM API Key

创建 `.env.local` 文件：

```env
GLM_API_KEY=your-api-key-here
GLM_MODEL=glm-5
```

#### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4.2 使用流程

1. **访问 Landing Page**
   - 了解项目概念
   - 查看三个 Agent 的介绍

2. **进入 Chat Page**
   - 输入你的需求（如："创建一个登录页面"）
   - PM Agent 分析需求并拆分任务
   - Dev Agent 实现功能
   - Review Agent 审查代码

3. **查看结果**
   - 任务列表（右侧边栏）
   - 生成的代码文件
   - 完整的协作历史

### 4.3 示例对话

```
用户：帮我创建一个计算器应用

PM Agent：
我已经分析了创建计算器的需求。
拆分为 3 个任务：
1. 界面构建 - 搭建 HTML/CSS 结构
2. 逻辑实现 - 编写 JS 计算逻辑  
3. 审查测试 - 检查功能和性能

Dev Agent，请开始实现第一个任务。

Dev Agent：
✅ 已创建文件：src/components/Calculator.tsx
实现内容：
- 加减乘除运算
- 清除和退格功能
- 响应式设计

Review Agent：
审查结果：
✅ 代码风格 - 良好
✅ 类型安全 - 完整
⚠️ 建议添加单元测试

批准通过 ✅
```

---

## 5. 项目特色

### 5.1 核心特性

| 特性 | 说明 |
|------|------|
| **真实协作** | 不是模拟，是真的多个 AI agent 在协作 |
| **OpenClaw 驱动** | 利用 OpenClaw 强大的 spawn 和协调能力 |
| **GLM-5 加持** | 智能分析需求，精准拆分任务 |
| **真实编码** | Dev Agent 使用真实的编码代理（OpenCode） |
| **开源可用** | 完全开源，欢迎 Star 和 Fork |

### 5.2 技术亮点

1. **OpenClaw 作为 Orchestrator**
   - 利用 OpenClaw 的 spawn 能力
   - 协调多个 Agent 协作
   - 统一的消息和任务管理

2. **真实的 AI 团队**
   - PM Agent：智能分析（GLM-5）
   - Dev Agent：真实编码（OpenCode）
   - Review Agent：智能审查（GLM-5）

3. **完整的开发流程**
   - 需求分析 → 任务拆分 → 代码实现 → 质量审查
   - 模拟真实团队的协作流程

4. **测试驱动开发（TDD）**
   - 7 套测试套件
   - 45 个测试用例
   - 100% 测试通过率

---

## 6. 未来规划

### 6.1 短期目标（1-2 周）

- [ ] 添加更多 Agent（Tester、Doc Writer）
- [ ] 支持更多 LLM（Claude、GPT-4）
- [ ] 优化 Agent 协作流程
- [ ] 添加 Git 集成（自动 commit）

### 6.2 中期目标（1-2 月）

- [ ] 实现并行任务执行
- [ ] 添加人工介入点（Review 不通过时通知用户）
- [ ] 支持更多编码代理（Codex、Claude Code）
- [ ] 添加项目模板（Web App、CLI、API）

### 6.3 长期目标（3-6 月）

- [ ] 构建 Agent 市场（分享自定义 Agent）
- [ ] 支持团队协作（多人+多Agent）
- [ ] 添加学习功能（从历史项目学习）
- [ ] 支持 Vercel/Railway 自动部署

---

## 7. 统计数据

### 7.1 代码统计

| 项目 | 数量 |
|------|------|
| **Commits** | 38 |
| **代码行数** | ~4,363 |
| **文件数** | ~60 |
| **测试套件** | 7 |
| **测试用例** | 45 |
| **测试通过率** | 100% |
| **测试时间** | 0.5s |

### 7.2 开发时间

| 阶段 | 时间 |
|------|------|
| 项目初始化 | 2 小时 |
| 核心功能开发 | 4 小时 |
| 测试和优化 | 2 小时 |
| **总计** | **8 小时** |

---

## 8. 总结

ClawCompany 展示了如何利用 OpenClaw 构建一个真实的 AI 虚拟团队协作系统。

**核心价值：**
- 🎯 **一人企业家**：一个人也能像拥有一支完整团队一样工作
- 🤖 **真实协作**：不是模拟，是真的多个 AI agent 在协作
- 🚀 **OpenClaw 驱动**：充分利用 OpenClaw 的强大能力
- 💡 **开源可用**：完全开源，欢迎贡献

**适用场景：**
- 快速原型开发
- 小型项目实现
- 学习 AI Agent 协作
- 自动化工作流

---

**GitHub**: https://github.com/felix-miao/ClawCompany  
**作者**: Felix Miao  
**比赛**: OpenClaw 龙虾大赛 2026
