# ClawCompany - AI 虚拟团队协作系统

## 📋 描述

通过 OpenClaw 组建 AI 虚拟团队，实现一人企业家的工作模式。让一个人也能像拥有一支完整团队一样工作。

## 🎯 使用场景

- **快速原型开发** - 从需求到可运行代码
- **自动化代码生成** - AI 团队协作生成项目
- **项目脚手架** - 快速搭建项目结构
- **学习 AI Agent 协作** - 了解多 Agent 系统工作原理

## 🚀 使用方法

### 在 OpenClaw 中使用

**基本用法：**

```
用户：帮我创建一个登录页面
OpenClaw：（自动调用 ClawCompany skill）
  📋 PM Agent 分析需求...
  💻 Dev Agent 生成代码...
  🔍 Review Agent 审查质量...
  ✅ 项目完成！
```

**指定项目路径：**

```
用户：在 /path/to/project 创建一个计算器应用
OpenClaw：
  [ClawCompany] 开始处理...
  [ClawCompany] 项目路径: /path/to/project
  [ClawCompany] 完成了 3 个任务
```

### 通过 API 使用

```typescript
import { createProject } from 'clawcompany'

const result = await createProject(
  "创建一个登录页面，包含邮箱和密码输入",
  "/path/to/project"
)

console.log(result.summary)
// 输出：完成了 3 个任务
```

## 🤖 Agent 角色

### 1. PM Agent (产品经理)
- 📋 分析用户需求
- 📋 拆分成可执行的子任务
- 📋 分配任务给合适的 Agent
- 📋 协调团队进度

### 2. Dev Agent (开发者)
- 💻 理解任务需求
- 💻 生成/修改代码
- 💻 确保代码可运行
- 💻 提交给 Review Agent

### 3. Review Agent (审查员)
- 🔍 检查代码质量
- 🔍 安全性审查
- 🔍 性能优化建议
- 🔍 批准或要求修改

## ⚙️ 配置

### 必需配置

在 `.env` 或环境变量中设置：

```env
GLM_API_KEY=your-glm-api-key-here
GLM_MODEL=glm-5
```

### 可选配置

```env
# 项目根目录（默认：当前目录）
PROJECT_ROOT=/path/to/projects

# LLM 温度（默认：0.7）
LLM_TEMPERATURE=0.7

# 最大 token 数（默认：2000）
LLM_MAX_TOKENS=2000
```

## 📖 示例

### 示例 1：创建 Web 应用

```
用户：创建一个 Todo List 应用

ClawCompany：
  📋 PM Agent 分析需求...
  ✓ 拆分为 4 个任务：
    1. 创建 TodoItem 组件
    2. 实现 TodoList 逻辑
    3. 添加本地存储
    4. 编写测试

  💻 Dev Agent 实现...
  ✓ 创建了 3 个文件

  🔍 Review Agent 审查...
  ✓ 代码质量良好

  ✅ 项目完成！
```

### 示例 2：创建 API

```
用户：创建一个用户认证 API

ClawCompany：
  📋 PM Agent 分析...
  💻 Dev Agent 实现...
  🔍 Review Agent 审查...
  ✅ 完成了 3 个端点
```

## 🎨 工作流程

```
用户需求
    ↓
OpenClaw (Orchestrator)
    ↓
sessions_spawn PM Agent (subagent)
    ↓
分析需求 + 拆分任务
    ↓
sessions_spawn Dev Agent (acp, opencode)
    ↓
生成代码文件
    ↓
sessions_spawn Review Agent (subagent)
    ↓
审查代码质量
    ↓
✅ 完成或重新执行
```

## 🔧 高级用法

### 自定义 Agent

```typescript
import { ClawCompanyOrchestrator } from 'clawcompany'

const orchestrator = new ClawCompanyOrchestrator({
  agents: {
    pm: {
      thinking: "high",
      model: "glm-5"
    },
    dev: {
      runtime: "acp",
      agentId: "opencode"
    },
    review: {
      thinking: "high",
      checklist: [
        "代码风格",
        "类型安全",
        "错误处理",
        "性能优化"
      ]
    }
  }
})
```

### 添加自定义 Agent

```typescript
orchestrator.addAgent('tester', {
  runtime: "subagent",
  task: "编写单元测试"
})
```

## 📊 性能

- **PM Agent**: ~5-10 秒（分析需求）
- **Dev Agent**: ~30-60 秒（生成代码）
- **Review Agent**: ~5-10 秒（审查代码）
- **总时间**: ~1-2 分钟（完整流程）

## 🐛 故障排除

### 问题：GLM API 调用失败

**解决方案：**
```bash
# 检查 API Key
echo $GLM_API_KEY

# 测试 API
curl -X POST https://api.z.ai/api/coding/paas/v4/chat/completions \
  -H "Authorization: Bearer $GLM_API_KEY" \
  -d '{"model":"glm-5","messages":[{"role":"user","content":"test"}]}'
```

### 问题：OpenCode 无法启动

**解决方案：**
```bash
# 检查 OpenCode 安装
which opencode

# 或使用其他编码代理
export DEV_AGENT=codex
```

## 📝 版本历史

### v1.0.0 (2026-03-16)
- ✅ 初始版本
- ✅ PM/Dev/Review Agent
- ✅ OpenClaw 集成
- ✅ GLM-5 支持

## 📄 License

MIT

## 👥 贡献

欢迎贡献！请查看 GitHub 仓库：
https://github.com/felix-miao/ClawCompany

---

**作者**: Felix Miao  
**比赛**: OpenClaw 龙虾大赛 2026  
**分类**: 生产力龙虾
