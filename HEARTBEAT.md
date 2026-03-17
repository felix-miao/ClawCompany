# ⚡ ClawCompany 高强度开发计划 - 2026-03-17

## 🎯 目标：OpenClaw 真实集成 + 完成比赛材料

**当前状态：**
- ✅ 原型完成（Next.js + GLM-5 API）
- ✅ E2E 测试通过
- ⏳ OpenClaw 集成待开始

**截止日期：** 2026-03-19（还有2天）

---

## 📋 今日任务（2026-03-17）

### 🚀 Phase 3: OpenClaw Gateway 真实集成（10:00-18:00）

**目标：** 将原型升级为真实的 OpenClaw 集成

#### ✅ 10:00 - 启动 OpenClaw 集成
- [x] 确认混合模式方案（选项C）
- [x] 更新计划文档
- [ ] 开始研究 OpenClaw Gateway API

#### ⏳ 10:00-12:00 - OpenClaw Gateway 研究（2小时）
- [ ] 阅读 OpenClaw 文档（/opt/homebrew/lib/node_modules/openclaw/docs）
- [ ] 研究 sessions_spawn 使用方法
- [ ] 研究如何创建 sub-agent
- [ ] 测试 OpenClaw Gateway 连接
- [ ] Commit + Push

#### 12:00-14:00 - PM Agent 集成（2小时）
- [ ] 实现 PM Agent 的 sessions_spawn
- [ ] 测试 PM Agent 与 OpenClaw 的通信
- [ ] 添加错误处理
- [ ] 集成测试
- [ ] Commit + Push

#### 14:00-16:00 - Dev Agent 集成（2小时）
- [ ] 实现 Dev Agent 的 sessions_spawn
- [ ] 配置 OpenCode/Codex agent
- [ ] 测试 Dev Agent 功能
- [ ] 集成测试
- [ ] Commit + Push

#### 16:00-18:00 - Review Agent 集成（2小时）
- [ ] 实现 Review Agent 的 sessions_spawn
- [ ] 测试 Review Agent 功能
- [ ] 完整协作流程测试
- [ ] E2E 测试更新
- [ ] Commit + Push

---

### 🎬 Phase 4: Demo 录制（18:00-20:00）

**18:00-19:00 - 准备 Demo**
- [ ] 测试完整流程（原型或 OpenClaw）
- [ ] 准备 Demo 脚本
- [ ] 录屏工具测试

**19:00-20:00 - 录制 Demo**
- [ ] 录制 3 分钟 Demo
- [ ] 后期剪辑（可选）
- [ ] 上传到视频平台

---

### 📝 Phase 5: 比赛材料（20:00-22:00）

**20:00-21:00 - 项目说明书**
- [ ] 完善 10 页 PDF
- [ ] 添加架构图
- [ ] 添加技术说明
- [ ] 添加 OpenClaw 集成说明

**21:00-22:00 - 最终检查**
- [ ] 检查所有材料
- [ ] 提交前测试
- [ ] 准备提交

---

## 🎯 每小时检查清单

**每次心跳执行：**

1. **检查进度**（2分钟）
   ```bash
   cd /Users/felixmiao/Projects/ClawCompany
   git log -1 --format="%ai %s"
   npm test
   ```

2. **继续当前任务**（50分钟）
   - 按照上述计划执行
   - 每完成一个功能立即测试
   - Commit + Push

3. **更新文档**（5分钟）
   - 更新 memory/2026-03-17.md
   - 记录进度和问题

4. **报告进度**（3分钟）
   - 告诉用户当前进度
   - 下一步计划

---

## 📊 当前进度（10:09）

**✅ 已完成：**
- Phase 1: 原型开发（Next.js + GLM-5）
- Phase 2: E2E 测试（Playwright）
- 真实 API 测试通过
- 混合模式方案确认

**🔄 进行中：**
- Phase 3: OpenClaw 集成（研究阶段）

**⏭️ 下一步：**
- 研究 OpenClaw Gateway API
- 实现 PM Agent 集成

---

## 🎯 关键决策

**架构选择：选项C（混合模式）**
- ✅ 保留当前原型（可立即录制 Demo）
- ✅ 同时开发 OpenClaw 集成（真实能力）
- ✅ 两者都有，灵活性高

**OpenClaw 集成方案：**
- PM Agent: runtime='subagent'
- Dev Agent: runtime='acp', agentId='opencode'
- Review Agent: runtime='subagent'

**模式切换：**
```bash
USE_OPENCLAW_GATEWAY=false  # 原型（GLM-5 API）
USE_OPENCLAW_GATEWAY=true   # OpenClaw 集成
```

---

## ⚠️ 规则

- ✅ **每完成功能立即 commit**
- ✅ **所有测试必须通过**
- ✅ **保持原型可用（向后兼容）**
- ✅ **OpenClaw 集成作为增强功能**

---

## 🔥 Token 消耗目标

| 时间段 | 目标消耗 | 任务 |
|--------|---------|------|
| 10:00-12:00 | 30k | OpenClaw 研究 |
| 12:00-14:00 | 30k | PM Agent 集成 |
| 14:00-16:00 | 30k | Dev Agent 集成 |
| 16:00-18:00 | 30k | Review Agent 集成 |
| 18:00-20:00 | 20k | Demo 录制 |
| 20:00-22:00 | 20k | 比赛材料 |
| **总计** | **160k** | **完整集成** |

---

## 📦 文件结构

**当前原型：**
```
ai-team-demo/
├── src/app/
│   ├── api/agent/route.ts  # 当前 API
│   └── team/page.tsx       # 前端页面
└── e2e/demo.spec.ts        # E2E 测试
```

**OpenClaw 集成后：**
```
ai-team-demo/
├── src/app/
│   ├── api/agent/route.ts        # 保留（向后兼容）
│   ├── api/openclaw/route.ts     # 新增：OpenClaw API
│   └── team/page.tsx             # 更新：支持两种模式
├── src/lib/openclaw/
│   ├── gateway-client.ts         # 新增：Gateway 客户端
│   └── agent-spawner.ts          # 新增：Agent 生成器
└── e2e/
    ├── demo.spec.ts              # 原型测试
    └── openclaw.spec.ts          # 新增：OpenClaw 测试
```

---

**立即开始：OpenClaw Gateway 研究！** 🚀

---

*计划创建: 2026-03-17 10:00*
*计划更新: 2026-03-17 10:09*
*下次检查: 11:00 (heartbeat)*
