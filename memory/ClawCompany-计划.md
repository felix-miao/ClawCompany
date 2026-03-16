# ClawCompany 项目计划 - 2026-03-16

## 🎯 核心目标
- **比赛**: OpenClaw 龙虾大赛（第一届）- 生产力龙虾赛道
- **概念**: 一人企业家 + AI 虚拟团队
- **截止**: 2026-03-19（还剩3天）
- **今晚**: 8:00 PM 录制 demo 视频

---

## 📊 当前进度总览（17:50）

### ✅ 已完成（核心功能）
- [x] Next.js 14 项目 + Tailwind + 暗色主题 + Framer Motion
- [x] Landing Page + Demo Page + Chat Page
- [x] Jest 测试框架（45个测试全通过）
- [x] GLM-5 API 确认可用
- [x] 项目海报（HTML版）
- [x] 项目说明书（10页框架）
- [x] **sessions_spawn 真实调用成功** ✨ (17:30)
- [x] **Web Portal 页面** (`/team`) ✨ (17:45)
- [x] **Agent API** (直接调用 GLM-5) ✨ (17:45)

### 🚧 进行中
- [ ] 修复 ESLint 错误
- [ ] 确保 `npm run build` 成功
- [ ] 测试 E2E 流程

### 📋 待完成（今晚8点前）
- [ ] 启动 dev server 并测试
- [ ] 优化 UI（loading 状态、错误处理）
- [ ] 录制 demo 视频（3分钟）
- [ ] 上传视频

---

## 🔑 关键突破（17:30-17:50）

### 1. sessions_spawn 真实调用成功 ✅

**测试结果：**
```javascript
const sessionKey = await sessions_spawn({
  runtime: 'subagent',
  task: '测试任务',
  thinking: 'high',
  mode: 'run'
})
// ✅ 返回: agent:main:subagent:6c20c890-80fb-4dbe-a96c-ce42ae7bce5a
// ✅ GLM-5 响应: "测试成功"
// ✅ 耗时: 4秒
```

**关键发现：**
- ✅ sessions_spawn 在 OpenClaw 主进程中可以直接访问
- ✅ 每个 subagent 有独立的 sessionKey
- ✅ sessions_history 可以获取回复
- ✅ **不需要3个独立 OpenClaw！**

---

### 2. 架构确认：1个 OpenClaw 足够 ✅

**用户问题：** 是否需要3个独立 OpenClaw 运行 PM/Dev/Review Agent？

**答案：❌ 不需要！**

**原因：**
- OpenClaw 的 `sessions_spawn` 设计就是用于创建独立 subagent
- 每个 subagent 有独立的 session 和对话历史
- 它们共享同一个 OpenClaw 环境
- 资源消耗：1x 而非 3x

**类比：** 不需要3个浏览器，只需要1个浏览器 + 3个标签页

---

### 3. 需求变更：Web Portal 方案 ✅

**用户要求：**
- 需要 Web Portal（不仅仅是 Demo）
- 可以添加/编辑不同的 Agent
- 每个 Agent 有可编辑的 system prompt
- 用户输入需求后，调用 OpenClaw
- 通过 sessions_spawn 启动不同 subagent
- 实时展示 subagent 的回复
- 看起来像一个人带着团队干活

**实现方案：**
- **Frontend**: Next.js `/team` 页面
- **Backend**: `/api/agent` 直接调用 GLM-5 API（原型）
- **Future**: 通过 OpenClaw Gateway API 调用 sessions_spawn

**文件结构：**
```
ai-team-demo/
├── src/
│   ├── app/
│   │   ├── team/page.tsx       # 新的 Portal 主入口 ✅
│   │   ├── api/agent/route.ts  # Agent API ✅
│   │   └── page.tsx            # Landing Page（导航到 /team）✅
│   ├── lib/agents/
│   │   └── config.ts           # Agent 配置（PM/Dev/Review）✅
│   └── types/
│       └── openclaw.d.ts       # OpenClaw API 类型声明 ✅
```

---

## 🚀 下一步行动（今晚8点前）

### 高优先级（必须完成）
- [ ] 修复 ESLint 错误（.eslintrc.json 已更新）
- [ ] 确保 `npm run build` 成功
- [ ] 启动 dev server: `npm run dev`
- [ ] 访问 http://localhost:3000/team 测试 E2E 流程
- [ ] 修复任何运行时错误

### 中优先级（优化体验）
- [ ] 添加 loading 动画
- [ ] 优化错误提示
- [ ] 测试 PM → Dev → Review 完整流程

### 低优先级（可选）
- [ ] 添加"添加自定义 Agent"功能
- [ ] 集成 OpenClaw Gateway API（真实 sessions_spawn）
- [ ] 发布到 ClawHub

---

## 📅 时间线（今晚）

| 时间 | 任务 | 状态 |
|------|------|------|
| 17:50-18:00 | 修复 ESLint + build | 🚧 |
| 18:00-18:30 | 测试 E2E 流程 | ⏳ |
| 18:30-19:00 | 优化 UI | ⏳ |
| 19:00-19:30 | 最终检查 | ⏳ |
| 19:30-19:50 | 录制准备 | ⏳ |
| 20:00 | **录制 demo** | 🎯 |

---

## 🛠️ 技术栈

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Next.js API Routes
- **LLM**: GLM-5 (智谱AI)
- **测试**: Jest, React Testing Library
- **部署**: GitHub Pages (海报), Vercel (demo)

---

## 📝 重要文件

- **项目**: `/Users/felixmiao/Projects/ClawCompany/ai-team-demo`
- **Portal**: `/Users/felixmiao/Projects/ClawCompany/ai-team-demo/src/app/team/page.tsx`
- **API**: `/Users/felixmiao/Projects/ClawCompany/ai-team-demo/src/app/api/agent/route.ts`
- **Config**: `/Users/felixmiao/Projects/ClawCompany/ai-team-demo/src/lib/agents/config.ts`
- **海报**: `https://felix-miao.github.io/ClawCompany-Poster/`
- **GitHub**: `https://github.com/felix-miao/ClawCompany`

---

## 🎬 Demo 视频脚本（3分钟）

1. **Landing Page** (20秒) - 展示概念
2. **Portal** (150秒) - E2E 演示
   - 输入需求："创建登录页面"
   - PM Agent 分析需求
   - Dev Agent 实现功能
   - Review Agent 审查代码
3. **GitHub** (10秒) - 展示仓库

---

## ⚠️ 注意事项

- **TDD**: 所有新功能先写测试
- **Commit**: 每小时至少一次
- **测试**: 所有测试必须通过
- **时间**: 8点前必须准备好

---

*最后更新: 2026-03-16 17:50*
*下次 cron 检查: 18:50*
