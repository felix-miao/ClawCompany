# ClawCompany - AI 虚拟团队协作系统

> 一人企业家 + AI 团队 = 无限可能

## 🎯 项目简介

ClawCompany 是一个基于 AI Agent 的虚拟团队协作系统，让一个人也能像拥有一支完整团队一样工作。

### 核心功能

- **PM Agent** 📋 - 需求分析、任务拆分、团队协调
- **Dev Agent** 💻 - 代码实现、功能开发
- **Review Agent** 🔍 - 代码审查、质量保证

## 🏗️ 系统架构

```
┌─────────────────────────────────────┐
│         Web Frontend                │
│  (Next.js + React + Tailwind)       │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│         API Layer                   │
│  (/api/chat, /api/tasks, etc.)      │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│      Agent Orchestrator             │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │  PM  │ │ Dev  │ │Review│         │
│  └──────┘ └──────┘ └──────┘         │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│       Execution Layer               │
│  (File System, Git, Code Runner)    │
└─────────────────────────────────────┘
```

## 🚀 快速开始

### 安装依赖

```bash
cd ai-team-demo
npm install
```

### 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 运行测试

```bash
npm test
```

## 📁 项目结构

```
ai-team-demo/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API 路由
│   │   ├── demo/         # Demo 页面
│   │   └── page.tsx      # Landing Page
│   ├── lib/              # 核心库
│   │   ├── agents/       # Agent 系统
│   │   │   ├── base.ts       # Agent 基类
│   │   │   ├── pm-agent.ts   # PM Agent
│   │   │   ├── dev-agent.ts  # Dev Agent
│   │   │   ├── review-agent.ts # Review Agent
│   │   │   └── manager.ts    # Agent 管理器
│   │   ├── tasks/        # 任务管理
│   │   └── chat/         # 对话管理
│   └── components/       # React 组件
├── docs/                 # 文档
│   └── ARCHITECTURE.md   # 系统架构
└── README.md
```

## 🧪 测试

### 测试覆盖率

- Landing Page: 5 个测试 ✅
- Demo Page: 7 个测试 ✅
- **总计: 12 个测试全部通过** ✅

### 运行测试

```bash
npm test              # 运行所有测试
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率报告
```

## 🔧 开发

### 技术栈

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Testing**: Jest, React Testing Library
- **State**: React Context (计划中)
- **Database**: SQLite (计划中)

### 开发规范

- ✅ TDD: 先写测试，再写代码
- ✅ 每小时至少 commit 一次
- ✅ 所有测试必须通过
- ✅ 使用 Conventional Commits

## 📖 文档

- [系统架构](./docs/ARCHITECTURE.md)
- [API 文档](./docs/API.md) (待完善)
- [开发指南](./docs/DEVELOPMENT.md) (待完善)

## 🗺️ 路线图

### Phase 1: 核心框架 ✅
- [x] Agent 基础系统
- [x] Task Manager
- [x] Chat Manager
- [x] API 路由

### Phase 2: LLM 集成 (进行中)
- [ ] OpenAI API 集成
- [ ] Agent Prompt 设计
- [ ] 真实对话流程

### Phase 3: 执行能力
- [ ] 文件系统操作
- [ ] Git 集成
- [ ] 代码执行沙箱

### Phase 4: 前端集成
- [ ] 实时聊天界面
- [ ] 任务看板
- [ ] 代码预览

## 📄 License

MIT

## 👥 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](./CONTRIBUTING.md) (待完善)

---

**Built with ❤️ for OpenClaw Hackathon 2026**
