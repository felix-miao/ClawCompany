# ClawCompany Orchestrator 使用示例

## 基本用法

### 1. 在 OpenClaw 中直接运行

```bash
# 进入项目目录
cd /Users/felixmiao/Projects/ClawCompany

# 运行 orchestrator
npx tsx skill/orchestrator.ts "创建一个登录页面"
```

### 2. 在 OpenClaw 会话中调用

```
用户: 使用 ClawCompany orchestrator 创建一个 TODO 应用
```

OpenClaw 会：
1. 调用 PM Agent 分析需求
2. 生成任务列表
3. 为每个任务调用 Dev Agent
4. 调用 Review Agent 审查代码
5. 返回最终结果

## 示例场景

### 场景 1: 创建登录页面

**输入:**
```
创建一个登录页面，包含：
- 用户名/密码输入框
- 记住我选项
- 忘记密码链接
- 登录按钮
```

**预期输出:**
```json
{
  "success": true,
  "tasks": [
    {
      "id": "task-1",
      "title": "创建登录表单组件",
      "status": "done",
      "assignedTo": "dev"
    },
    {
      "id": "task-2",
      "title": "添加表单验证",
      "status": "done",
      "assignedTo": "dev"
    }
  ],
  "messages": [
    {
      "agent": "pm",
      "content": "## 需求分析\n\n我将创建一个包含用户名、密码、记住我选项的登录页面..."
    },
    {
      "agent": "dev",
      "content": "✅ 登录表单组件已创建\n✅ 表单验证已添加"
    },
    {
      "agent": "review",
      "content": "## 代码审查\n\n✅ 代码质量良好\n✅ 类型安全\n✅ 错误处理完善"
    }
  ]
}
```

### 场景 2: 实现 API 端点

**输入:**
```
创建一个 REST API 端点 /api/users，支持：
- GET: 获取用户列表
- POST: 创建新用户
- PUT: 更新用户
- DELETE: 删除用户
```

**工作流程:**
1. PM Agent 分析需求 → 拆分成 4 个任务
2. Dev Agent 实现每个端点
3. Review Agent 检查 API 设计和安全性

### 场景 3: 重构现有代码

**输入:**
```
重构 src/lib/agents/pm-agent.ts，使其支持：
- 插件系统
- 自定义 prompt
- 流式响应
```

**工作流程:**
1. PM Agent 分析现有代码
2. Dev Agent 逐步重构
3. Review Agent 确保向后兼容

## 高级用法

### 自定义 Agent 配置

```typescript
import { orchestrate } from './skill/orchestrator'

// 自定义配置
const result = await orchestrate('创建用户仪表盘', {
  pmAgent: {
    thinking: 'high',
    model: 'glm-5'
  },
  devAgent: {
    runtime: 'acp',
    agentId: 'codex',
    timeout: 180
  },
  reviewAgent: {
    thinking: 'high',
    checklist: ['security', 'performance', 'accessibility']
  }
})
```

### 集成到 CI/CD

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run AI Review
        run: |
          npm install
          npx tsx skill/orchestrator.ts "Review PR #${{ github.event.pull_request.number }}"
```

## 故障排除

### 问题 1: sessions_spawn 超时

**原因:** Agent 执行时间过长

**解决:** 增加 `runTimeoutSeconds`

```typescript
await sessions_spawn({
  runtime: 'subagent',
  task: '...',
  runTimeoutSeconds: 180 // 3 分钟
})
```

### 问题 2: Dev Agent 无法创建文件

**原因:** 权限问题或路径错误

**解决:** 检查 `cwd` 参数

```typescript
await sessions_spawn({
  runtime: 'acp',
  agentId: 'opencode',
  cwd: '/absolute/path/to/project'
})
```

### 问题 3: Review Agent 审查失败

**原因:** 代码质量问题

**解决:** 查看审查详情，修复问题后重新运行

## 性能优化

### 并行执行任务

对于没有依赖关系的任务，可以并行执行：

```typescript
// 未来功能：并行执行
const results = await Promise.all(
  tasks.map(task => spawnDevAgent(task))
)
```

### 缓存 Agent 响应

对于重复性任务，可以缓存响应：

```typescript
// 未来功能：响应缓存
const cache = new Map<string, string>()

async function spawnPMAgentCached(request: string) {
  if (cache.has(request)) {
    return cache.get(request)
  }
  const result = await spawnPMAgent(request)
  cache.set(request, result)
  return result
}
```

## 下一步

- [ ] 实现并行任务执行
- [ ] 添加响应缓存
- [ ] 支持 streaming 输出
- [ ] 集成到 Web UI
