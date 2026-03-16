# MEMORY.md - 长期记忆

## 🎯 当前主要任务

### OpenClaw 龙虾大赛（2026）

**背景：**
- 比赛截止：2026-03-19（还有4天）
- 赛道：生产力龙虾
- **核心概念：OpenClaw 作为"包工头"，spawn 多个 AI agent 组建虚拟团队**

**项目：ClawCompany**
- GitHub: https://github.com/felix-miao/ClawCompany
- 本地路径: `/Users/felixmiao/Projects/ClawCompany`
- **新架构文档**: `/Users/felixmiao/Projects/ClawCompany/docs/ARCHITECTURE-v2.md`

**核心创新：**
- ✅ OpenClaw = 包工头（Orchestrator）
- ✅ PM Agent = sub-agent（分析需求、拆分任务）
- ✅ Dev Agent = OpenCode/Codex（真实的编码代理）
- ✅ Review Agent = sub-agent（代码审查）
- ✅ 利用 OpenClaw 已有能力（spawn, exec, read/write, LLM）

**Cron 任务：**
- 任务名: `clawcompany-hourly`
- ID: `45fed7de-cc5c-4126-999d-d83d19ee5f81`
- 间隔: 每 1 小时

**待提交材料：**
- [ ] Demo 视频（需要手动录制）
- [x] 项目说明书（10页 PDF）- 内容已填充
- [ ] 项目海报
- [x] Skill 测试和示例 ✅ (15:10)

---

## 👤 用户信息

**老苗 (Miao)**
- 沟通风格：随意、不拘束、要求严格
- 工作地：微软
- 有绿联 DXP4800 NAS
- MacBook Pro，会休眠
- **强调TDD，不允许偷懒**

---

## 📝 重要决策记录

### 2026-03-15
1. ~~项目定位：工作流自动化 + AI 虚拟团队~~ → **新方向：OpenClaw 作为包工头**
2. **新架构（20:45）**：利用 OpenClaw spawn 能力，不是自己实现 Agent
3. 开发模式：TDD + 每小时 commit + 自动 push
4. 心跳机制：用 OpenClaw cron
5. LLM：GLM-5（已配置 API key）
6. **TDD教训（21:05）**：timestamp 错误因为没有遵循TDD

---

## ⚠️ 重要教训

### timestamp 错误（2026-03-15 21:05）

**问题：**
- API 返回的 messages 没有 timestamp 字段
- 前端 toLocaleTimeString() 报错

**根本原因：**
1. ❌ 没有遵循 TDD（先写测试）
2. ❌ 没有写 API 测试
3. ❌ 没有检查返回数据结构
4. ❌ 前后端数据格式不一致

**修复：**
- Orchestrator 返回时包含 timestamp
- Chat Page 接收时转换 timestamp 为 Date 对象
- 显示时做保护性检查

**教训：**
1. ✅ 必须严格遵循 TDD
2. ✅ 每次修改都要写测试
3. ✅ API 返回的数据结构必须有完整的测试
4. ✅ 前端必须处理可能为 undefined 的字段

**文档：**
- `docs/TDD-CHECKLIST.md` - TDD检查清单

---

## 🔧 技术笔记

### OpenClaw 使用
- Spawn sub-agent: `sessions_spawn({ runtime: "subagent", task: "..." })`
- Spawn 编码代理: `sessions_spawn({ runtime: "acp", agentId: "opencode" })`
- 发送消息: `sessions_send({ sessionKey, message })`
- Cron 配置: `openclaw cron add --every "1h"`

### 关键文件
- **新架构**: `ClawCompany/docs/ARCHITECTURE-v2.md`
- **TDD清单**: `ClawCompany/docs/TDD-CHECKLIST.md`
- **Demo脚本**: `ClawCompany/docs/DEMO-STORYBOARD.md`
- **旧架构**: ~~`ClawCompany/docs/ARCHITECTURE.md`~~（已过时）
- **快速检查**: `HEARTBEAT.md`（本目录）

### 测试命令
```bash
# 运行所有测试
npm test

# 运行特定测试
npm test path/to/test.ts

# 测试覆盖率
npm run test:coverage
```

---

## 📅 时间线

### 2026-03-15（今天）
- 16:52 - 项目初始化（旧架构）
- 17:42 - Agent 核心系统（旧架构）
- 20:03 - 文件系统操作（旧架构）
- 20:30 - GLM Provider 集成
- 20:45 - 架构大调整：OpenClaw 作为包工头
- 21:00 - 准备录 demo
- 21:03 - timestamp 错误，没有遵循TDD
- 21:05 - 修复并承诺严格遵循TDD
- 22:10 - **实现 OpenClaw Orchestrator 真实架构** ✅
  - 创建 orchestrator.ts（使用 sessions_spawn）
  - 添加集成指南和示例
  - 定义 API 设计
- 23:06 - **GLM-5 真实调用成功** ✅ (commit 1a4bdec)
  - PM Agent 使用真实的 GLM-5 API
  - 智能分析需求和拆分任务
  - 不再是硬编码回复

### 2026-03-16（今天）
- 00:10 - **优化 Dev Agent 和 Review Agent** ✨ (commit dd91740)
  - 增强 Dev Agent prompt，要求生成生产级别代码
  - 添加详细的代码质量要求（类型安全、错误处理、性能等）
  - 优化 Review Agent prompt，实现智能代码审查
  - 添加审查标准（功能、质量、安全、性能、可访问性）
  - 所有 agent 测试通过 ✅

- 03:11 - **修复 API route 测试** ✅ (commit f44c6a0)
  - 添加 Next.js server components mock
  - 使用 createMockRequest helper 替代 NextRequest
  - 所有测试通过 (7 suites, 45 tests)

- 03:14 - **简化 Dev Agent prompt** ✨ (commit 9cc0ad0)
  - 缩短 system prompt，降低 token 消耗和响应时间
  - 简化 JSON 格式要求，提高解析成功率
  - 更新 .gitignore，忽略生成的临时文件
  - 增加 LLM_MAX_TOKENS 到 4000

- 04:19 - **添加 Mock Provider** ✨ (commit 031992b)
  - 创建 MockProvider，提供快速预设响应
  - 支持环境变量 USE_MOCK_LLM 启用 mock 模式
  - 响应时间从 60+ 秒降低到 <1 秒（用于 demo）
  - 保留真实 GLM 调用（实际使用）
  - 所有测试通过（7 suites, 45 tests）✅

- 05:19 - **改进 Chat Page 体验** ✨ (commit eb2853c)
  - 添加欢迎消息，引导用户开始对话
  - 支持 Markdown 渲染（使用 react-markdown）
  - 改进消息显示格式，支持列表、加粗等
  - 安装 react-markdown 和 remark-gfm 依赖
  - Demo 体验更流畅

- 05:22 - **添加 Demo 录制检查清单** 📝 (commit 1162db0)
  - 创建 DEMO-RECORDING-CHECKLIST.md
  - 包含录制前、录制中、录制后的详细步骤
  - 添加常见问题解答和录制技巧
  - 方便快速开始录制 demo

- 06:19 - **优化 UI 细节** ✨ (commit 60e792d)
  - 改进 Markdown 渲染样式（标题、列表、加粗、代码）
  - Demo Page 的 "Start Your Project" 按钮链接到 Chat Page
  - 让 demo 录制流程更流畅

- 07:19 - **创建项目说明书大纲** 📄 (commit 7848b12)
  - 创建 PROJECT-DESCRIPTION.md（10页 PDF 框架）
  - 包含：背景、解决方案、技术架构、核心功能、创新点、使用场景等
  - 可用于 PDF 提交、README、海报设计
  - 为白天准备提交材料节省时间

- 07:22 - **创建项目海报设计大纲** 🎨 (commit 395389d)
  - 创建 POSTER-DESIGN.md
  - 包含完整的海报设计指南
  - 5 个区域布局、配色方案、字体建议
  - 快速制作步骤（使用 Canva）
  - 时间估算和检查清单

- 09:08 - **更新 README 和项目说明书** 📊 (commit 8c5b3cf)
  - 重写 README.md，完整的项目介绍
  - 填入真实的 GitHub 统计数据（29 commits, ~3650 行代码）
  - 更新测试数据（45 用例, 100% 通过, 0.5s）
  - 准备提交材料

- 09:52 - **完成项目说明书详细内容** 📄 (commit 0c6a358)
  - 填充 PROJECT-DESCRIPTION.md 的详细内容
  - 添加项目统计和成果
  - 完善所有章节

- 10:55 - **添加项目状态检查脚本** 🔍 (commit 9035b5d)
  - 创建 check-status.sh，快速查看项目状态
  - 检查 Git、测试、Mock 模式、服务器状态
  - 显示待办事项和快速命令
  - 方便用户快速了解项目进展

- 12:12 - **实现 ClawCompany skill 核心代码** ✨ (commit 44c4a6b)
  - 创建 skill/src/orchestrator.ts，真正的 OpenClaw spawn 实现
  - 使用 sessions_spawn 启动 PM/Dev/Review Agent
  - 实现完整的 AI 虚拟团队协作流程
  - 可作为 OpenClaw skill 直接使用

- 12:13 - **更新任务进度** ✅ (commit 7ec67dd)
  - Skill 核心代码完成
  - 项目文档更新

- 13:11 - **Demo 录制准备 + 提交检查清单** 🎬 (commit 3111020)
  - 创建 prepare-demo.sh，自动启用 Mock 模式
  - 创建 SUBMISSION-CHECKLIST.md，完整的提交材料检查清单
  - 包含 Demo 视频、项目说明书、项目海报的详细要求
  - 提供当前项目统计和快速命令

- 15:10 - **添加 skill 测试和使用示例** ✨ (commit 0e86c40)
  - 创建 skill 测试文件
  - 添加使用示例代码
  - 验证 skill 功能

- 16:08 - **更新项目统计数据** 📊 (commit a2df7a2)
  - 更新 README 和文档中的统计数据
  - 40 commits，~4500 行代码

**当前状态：**
- ✅ PM Agent 工作正常（GLM-5 真实调用）
- ✅ Mock Provider 已添加（demo 录制就绪）
- ✅ Chat Page 优化完成（欢迎消息 + Markdown）
- ✅ Demo 录制准备完成（检查清单 + 准备脚本）
- ✅ UI 细节优化完成
- ✅ 项目说明书完成（10页框架 + 详细内容）
- ✅ 项目海报设计大纲完成
- ✅ 项目状态检查脚本完成
- ✅ ClawCompany skill 核心代码 + 测试完成
- ✅ 提交材料检查清单完成
- ✅ 所有测试通过（7 suites, 45 tests）
- ✅ 代码已推送到 GitHub（40 commits）

---

## 🚀 下一步任务（新架构）

### Phase 1: 基础架构（今天晚上）✅ **已完成**
- [x] 实现 OpenClaw orchestration 逻辑 ✅ (22:10 - commit 6b98e40)
- [x] 实现 PM Agent spawn（框架已有，需真实集成）✅
- [x] 实现 Dev Agent spawn（框架已有，需真实集成）✅
- [x] 实现 Review Agent spawn（框架已有，需真实集成）✅
- [x] 优化 Dev Agent prompt ✅ (00:10 - commit dd91740)
- [x] 优化 Review Agent prompt ✅ (00:10 - commit dd91740)

### Phase 2: 完整流程（明天）
- [ ] 实现完整工作流
- [ ] 添加文件系统共享
- [ ] 测试端到端流程

### Phase 3: UI 集成（后天）
- [ ] Web UI 展示 agent 协作
- [ ] 实时显示每个 agent 的工作

---

## 🎬 Demo 相关

**Demo 分镜脚本：** `docs/DEMO-STORYBOARD.md`
- 总时长：2分30秒
- Landing Page（20秒）
- Chat Page（60秒）
- Demo Page（35秒）
- GitHub（30秒）

---

## 💡 我的承诺

1. ✅ 每次添加新功能，先写测试
2. ✅ 每次修复bug，先写失败的测试
3. ✅ 提交代码前，确保所有测试通过
4. ✅ 定期检查测试覆盖率
5. ✅ 不跳过测试，不偷懒

---

*最后更新: 2026-03-16 00:10*
