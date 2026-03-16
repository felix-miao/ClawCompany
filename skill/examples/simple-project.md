# ClawCompany 使用示例

## 基础使用

### 1. 创建简单项目

```typescript
import { createProject } from 'clawcompany'

// 发送需求给 AI 团队
const result = await createProject(
  "创建一个简单的登录页面，包含邮箱和密码输入框",
  "/path/to/your/project"
)

console.log(result.summary)
// 输出: 完成了 3 个任务

console.log(result.tasks)
// 输出: 任务列表

console.log(result.results)
// 输出: 每个任务的执行结果
```

### 2. 使用 Orchestrator 类

```typescript
import { ClawCompanyOrchestrator } from 'clawcompany'

const orchestrator = new ClawCompanyOrchestrator({
  thinking: 'high',      // 思考深度
  model: 'glm-5',        // LLM 模型
  projectPath: '/my/project'
})

const result = await orchestrator.execute(
  "创建一个 REST API，包含用户 CRUD 操作"
)
```

### 3. 处理复杂项目

```typescript
const result = await createProject(`
  创建一个博客系统，包含：
  1. 用户注册和登录
  2. 文章发布和编辑
  3. 评论功能
  4. 管理后台
`)

if (result.success) {
  console.log(`✅ 项目创建成功！`)
  console.log(`📁 生成了 ${result.results.length} 个文件`)
  
  result.results.forEach(r => {
    console.log(`\n任务: ${r.task.title}`)
    console.log(`文件: ${r.files.join(', ')}`)
    console.log(`审查: ${r.review.approved ? '通过 ✅' : '需要修改 ⚠️'}`)
  })
}
```

## 在 OpenClaw 中使用

ClawCompany 设计为 OpenClaw Skill，可以在 OpenClaw 中直接使用：

```
用户：帮我创建一个计算器应用

OpenClaw：（自动调用 ClawCompany skill）
  📋 PM Agent 分析需求...
  ✓ 拆分为 3 个任务
  
  💻 Dev Agent 执行任务: 界面构建
  ✓ Dev Agent 完成
  
  🔍 Review Agent 审查...
  ✓ 审查通过
  
  ... (继续执行其他任务)
  
  ✅ 完成了 3 个任务
```

## 自定义配置

```typescript
const orchestrator = new ClawCompanyOrchestrator({
  thinking: 'medium',    // low | medium | high
  model: 'glm-5',        // LLM 模型
  projectPath: process.cwd()
})

// 执行
const result = await orchestrator.execute('你的需求')
```

## 错误处理

```typescript
try {
  const result = await createProject('创建一个项目')
  
  if (!result.success) {
    console.error('执行失败:', result.summary)
    return
  }
  
  // 处理成功结果
  console.log(result.summary)
  
} catch (error) {
  console.error('发生错误:', error)
}
```

## 完整示例

```typescript
import { ClawCompanyOrchestrator } from 'clawcompany'

async function main() {
  const orchestrator = new ClawCompanyOrchestrator({
    thinking: 'high',
    model: 'glm-5'
  })

  console.log('🦞 ClawCompany AI 团队启动...\n')

  const result = await orchestrator.execute(
    '创建一个简单的 Todo 应用，支持添加、删除、标记完成功能'
  )

  console.log('\n📊 执行结果:')
  console.log(`状态: ${result.success ? '成功 ✅' : '失败 ❌'}`)
  console.log(`任务数: ${result.tasks.length}`)
  console.log(`摘要: ${result.summary}`)

  if (result.success) {
    console.log('\n📝 任务详情:')
    result.results.forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.task.title}`)
      console.log(`   文件: ${r.files.join(', ') || '无'}`)
      console.log(`   审查: ${r.review.summary}`)
    })
  }
}

main().catch(console.error)
```
