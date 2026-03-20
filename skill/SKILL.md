# ClawCompany - AI 虚拟团队协作系统

> 一人企业家 + AI 团队 = 无限可能

## 描述

ClawCompany 将 OpenClaw 定位为"包工头"（Orchestrator），协调三个智能 Agent 组成虚拟开发团队：

- **📋 PM Agent** - 产品经理，负责需求分析、任务拆分、团队协调
- **💻 Dev Agent** - 开发者，负责代码实现、功能开发
- **🔍 Review Agent** - 审查员，负责代码审查、质量保证

通过 OpenClaw 的 `sessions_spawn`、`sessions_send` 和 `sessions_yield` 工具，实现真实的 AI 团队协作。

## 使用场景

- 需要快速原型开发
- 一个人完成完整的项目开发流程
- 学习 AI 辅助开发的最佳实践
- 自动化代码审查和质量保证
- 提升开发效率 10-100 倍

## 核心能力

### 1. 智能需求分析
- PM Agent 使用 GLM-5 分析用户需求
- 自动拆分为可执行的开发任务
- 评估任务优先级和依赖关系

### 2. 自动代码生成
- Dev Agent 使用 Codex/OpenCode 实现代码
- 支持多种编程语言和框架
- 自动生成测试用例

### 3. 代码审查
- Review Agent 使用 GLM-5 审查代码质量
- 检查最佳实践和安全问题
- 提供改进建议

### 4. 团队协调
- OpenClaw 作为 Orchestrator 协调整个流程
- 管理 agent 间的消息传递
- 汇总结果并返回给用户

## 工作流程

### 标准流程（3步）

```
1. 需求分析
   用户输入 → PM Agent → 任务列表

2. 代码实现
   任务列表 → Dev Agent → 代码实现

3. 代码审查
   代码 → Review Agent → 审查报告
```

### 详细步骤

**Step 1: 用户提交需求**
```
用户: "创建一个登录页面，包含邮箱和密码输入"
```

**Step 2: PM Agent 分析**
```typescript
// OpenClaw 自动调用
sessions_spawn({
  task: "分析需求: 创建一个登录页面",
  runtime: "subagent",
  model: "zai/glm-5",
  mode: "run"
})
```

**Step 3: Dev Agent 实现**
```typescript
// 根据 PM 的任务列表
sessions_spawn({
  task: "实现登录页面功能",
  runtime: "acp",
  agentId: "codex",
  mode: "run"
})
```

**Step 4: Review Agent 审查**
```typescript
sessions_spawn({
  task: "审查登录页面代码质量",
  runtime: "subagent",
  model: "zai/glm-5",
  mode: "run"
})
```

**Step 5: 返回结果**
```
OpenClaw 汇总所有 agent 的输出，返回给用户
```

## 示例

### 示例 1: 创建简单的 Web 应用

**用户:**
```
创建一个待办事项应用，支持添加、删除、标记完成功能
```

**ClawCompany 响应:**

```
🚀 启动 AI 团队协作...

📋 PM Agent 分析中...
- 任务 1: 创建 React 组件结构
- 任务 2: 实现添加待办功能
- 任务 3: 实现删除待办功能
- 任务 4: 实现标记完成功能
- 任务 5: 添加样式和交互

💻 Dev Agent 实现中...
✅ 创建 TodoApp.tsx
✅ 实现 addTodo() 函数
✅ 实现 deleteTodo() 函数
✅ 实现 toggleTodo() 函数
✅ 添加 Tailwind CSS 样式

🔍 Review Agent 审查中...
✅ 代码结构清晰
✅ 使用了 TypeScript 类型
⚠️ 建议: 添加本地存储持久化
⚠️ 建议: 添加错误处理

📦 交付文件:
- src/TodoApp.tsx (主组件)
- src/types.ts (类型定义)
- src/hooks/useTodos.ts (自定义 Hook)

✨ 任务完成！
```

---

### 示例 2: 代码重构

**用户:**
```
重构 src/utils.ts，拆分为多个模块，提高可维护性
```

**ClawCompany 响应:**

```
🚀 启动代码重构流程...

📋 PM Agent 分析中...
- 分析 src/utils.ts (1200 行)
- 识别 5 个功能模块
- 制定重构计划

💻 Dev Agent 重构中...
✅ 创建 src/utils/string.ts (字符串工具)
✅ 创建 src/utils/date.ts (日期工具)
✅ 创建 src/utils/array.ts (数组工具)
✅ 创建 src/utils/object.ts (对象工具)
✅ 创建 src/utils/validation.ts (验证工具)
✅ 更新所有导入路径

🔍 Review Agent 审查中...
✅ 模块划分合理
✅ 保持向后兼容
✅ 添加了单元测试
✅ 文档完整

📊 重构成果:
- 文件数: 1 → 6
- 平均文件大小: 1200 行 → 200 行
- 可维护性: ⬆️ 提升 80%
- 测试覆盖率: 0% → 85%

✨ 重构完成！
```

---

## 最佳实践

### 1. 清晰的需求描述
- ✅ 明确功能需求
- ✅ 指定技术栈（React/Vue/Node 等）
- ✅ 说明性能要求
- ❌ 避免模糊的描述

### 2. 合理的任务拆分
- PM Agent 会自动拆分任务
- 可以手动指定任务优先级
- 大型项目建议分阶段进行

### 3. 代码审查反馈
- Review Agent 的建议应该认真考虑
- 可以要求 Dev Agent 根据审查结果优化
- 重视安全和性能问题

### 4. 迭代开发
- 支持多轮对话和迭代
- 每次迭代都可以改进代码
- 逐步完善功能

## 技术架构

### 真实架构（基于 OpenClaw）

```
┌─────────────────────────────────────────────┐
│         OpenClaw (Orchestrator)              │
│  - 接收用户需求                              │
│  - 调用 sessions_spawn 创建 agents           │
│  - 使用 sessions_send 传递消息               │
│  - 使用 sessions_yield 等待结果              │
└─────────────────────────────────────────────┘
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
┌───────┐ ┌───────┐ ┌───────┐
│ PM    │ │ Dev   │ │Review │
│Agent  │ │Agent  │ │ Agent │
│       │ │       │ │       │
│GLM-5  │ │ ACP   │ │ GLM-5 │
└───────┘ └───────┘ └───────┘
              ↓
          Codex/
         OpenCode
```

### 与 Demo 版本的区别

| 组件 | Demo 版本 | 真实版本 |
|------|----------|---------|
| Orchestrator | 自定义类 | OpenClaw 本身 |
| PM Agent | 硬编码 | sessions_spawn + GLM-5 |
| Dev Agent | 模板生成 | sessions_spawn + ACP |
| Review Agent | 随机检查 | sessions_spawn + GLM-5 |
| 文件操作 | 自定义 | read/write/edit |
| 消息系统 | 自定义 | sessions_send |

**优势:**
- ✅ 更简单（无需自定义代码）
- ✅ 更可靠（使用 OpenClaw 原生工具）
- ✅ 更强大（支持真实代码生成）

## 限制与注意事项

### 当前限制

1. **并发限制**
   - 最多 8 个并发 sub-agents
   - 大型项目需要分批处理

2. **超时控制**
   - 单个任务最长 10 分钟
   - 复杂任务需要拆分

3. **文件系统**
   - 所有 agents 共享工作空间
   - 注意文件冲突

4. **ACP Agent 配置**
   - 需要预先配置 Codex/Claude Code
   - 否则使用 GLM-5 作为替代

### 最佳实践建议

1. **从小项目开始**
   - 先验证简单功能
   - 逐步增加复杂度

2. **明确技术栈**
   - 指定使用的框架和库
   - 避免 agent 猜测

3. **定期检查进度**
   - 使用 sessions_list 监控状态
   - 及时处理超时和错误

4. **保留人工审查**
   - AI 生成代码需要人工检查
   - 特别是安全和性能关键部分

## 相关 Skills

- **pm-claw** - 产品经理 skill（需求分析）
- **dev-claw** - 开发者 skill（代码实现）
- **reviewer-claw** - 审查员 skill（代码审查）
- **architect** - 架构师 skill（系统设计）
- **tester** - 测试工程师 skill（测试用例）

## 更新日志

### v1.0.0 (2026-03-20)
- ✅ 完成技术可行性研究
- ✅ 验证 OpenClaw Gateway 集成
- ✅ 设计真实架构
- ⏳ 实施中...

---

**作者:** ClawCompany Team  
**许可:** MIT  
**主页:** https://github.com/felix-miao/ClawCompany  
**文档:** [完整文档](../docs/)
