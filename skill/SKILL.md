# ClawCompany Orchestrator Skill

## 描述

真实的 OpenClaw 集成，使用 sessions_spawn 创建 AI 虚拟团队（PM + Dev + Review）。

## 用法

在 OpenClaw 中运行：

```
使用 ClawCompany orchestrator 处理用户需求："创建一个登录页面"
```

或者直接调用：

```typescript
import { orchestrate } from './skill/orchestrator'

const result = await orchestrate('创建一个登录页面')
console.log(result)
```

## 工作流程

1. **PM Agent** (runtime: subagent)
   - 分析用户需求
   - 拆分成可执行任务
   - 分配给合适的 Agent

2. **Dev Agent** (runtime: acp/opencode)
   - 实现代码
   - 创建/修改文件
   - 提交审查

3. **Review Agent** (runtime: subagent)
   - 代码审查
   - 质量检查
   - 批准或要求修改

## 输出

```typescript
{
  success: boolean
  tasks: Task[]
  messages: Array<{
    agent: string
    content: string
    timestamp: string
  }>
}
```

## 依赖

- OpenClaw Gateway 运行中
- sessions_spawn 工具可用
- sessions_history 工具可用

## 示例

```bash
# 在 OpenClaw 中运行
cd /Users/felixmiao/Projects/ClawCompany
node -e "require('./skill/orchestrator').orchestrate('创建一个 TODO 应用')"
```

## 状态

✅ 可工作 - 使用真实的 sessions_spawn API

## 文件

- `orchestrator.ts` - 主要逻辑
- `SKILL.md` - 本文档
- `examples/` - 示例用法
