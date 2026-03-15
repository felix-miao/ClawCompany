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
- [x] Demo 视频（正在录制）
- [ ] 项目说明书（10页 PDF）
- [ ] 项目海报

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

---

## 🚀 下一步任务（新架构）

### Phase 1: 基础架构（今天晚上）
- [x] 实现 OpenClaw orchestration 逻辑 ✅ (22:10 - commit 6b98e40)
- [ ] 实现 PM Agent spawn（框架已有，需真实集成）
- [ ] 实现 Dev Agent spawn（框架已有，需真实集成）
- [ ] 实现 Review Agent spawn（框架已有，需真实集成）
- [ ] OpenClaw API endpoints（**下一步优先任务**）

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

*最后更新: 2026-03-15 21:05*
