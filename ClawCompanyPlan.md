# ClawCompany 开发计划

> 本地 canonical 计划文件。OpenClaw cron / ACP 一律读取本文件；`~/.openclaw/workspace/memory/ClawCompanyPlan.md` 只保留迁移提示，不再作为任务来源。

## 状态流转

```
[ ] → [code-complete] → [x]
       developer         reviewer sign-off

或打回：
[code-complete] → [ ] + 子问题
```
- `[ ]` 待做
- `[code-complete]` 代码完成，等审查
- `[x]` 已 sign-off（只有 Reviewer 能标记）

---

## 已完成记录

### P0 - Critical Fixes（第三轮源码审计 2026-04-10）

- [x] ~~#001 三版 IMPLEMENTATION_PLAN 并存~~ → commit 77352ff 已删除
- [x] ~~#002 `/api/openclaw` 同步阻塞轮询~~ → 已改为立即返回 sessionKey
- [x] ~~#005 SceneEventBridge 未激活~~ → OfficeScene.ts 已调用 setupEventBridge()
- [x] ~~#177 Phaser 未做动态导入~~ → page.tsx useEffect 内动态 import
- [x] ~~#003 AgentCharacter 角色是纯色方块，无帧动画~~ → commit 603b79b 已实现程序化像素小人 + idle/walk/work 帧动画
- [x] ~~#006 MEMORY.md.backup 包含个人信息提交进公开仓库~~ → commits 616db1e, 499aaa3 已处理 .gitignore + 删除 backup 文件（需人工 git history rewrite）
- [x] ~~#067 game-events GET 端点完全无认证保护~~ → commit 7eb6e0b 已修复
- [x] ~~#068 全局单例在 Serverless 环境下状态污染~~ → commit 统一修复，5处模块级单例改 factory/DI
- [x] ~~#069 ChatManager 无消息数量上限，内存无界增长~~ → commit 已加 maxMessages=500 限制
- [x] ~~#070 api/client.ts fetch 无超时控制~~ → commit 已加 AbortController + setTimeout
- [x] ~~#141 Prompt Injection via Unfiltered User Message~~ → commit 已加 sanitizeUserInput
- [x] ~~#142 AI 生成代码自动写入磁盘无人工审核~~ → commit 已改为危险内容阻断
- [x] ~~#159 函数覆盖率不足，核心逻辑测试盲区多~~ → commit 已设置 Functions ≥ 80% 阈值并补充测试
- [x] ~~#160 无 CI 流水线，测试从不自动运行~~ → commit 已添加 GitHub Actions workflow
- [x] ~~#176 SSE 连接数无限制，服务器资源耗尽风险~~ → commit b8b82e5 已加 MAX_SSE_CONNECTIONS=100
- [x] ~~#178 DashboardStore.events 用 Array.shift() O(n)~~ → commit 611af89 已改环形缓冲区
- [x] ~~#213 完全缺失 CI/CD Pipeline~~ → 已合并到 #160
- [x] ~~#214 缺少 Dockerfile 和容器化方案~~ → commit f57ce7f 已完成 Dockerfile + docker-compose.yml
- [x] ~~#215 本地绝对路径硬编码在 .env.example~~ → 已改为相对路径 `./generated`

### P0 - Dashboard 实时任务追踪（产品可见）

- [x] ~~#P0-DASH-TRADITIONAL Dashboard 增加传统任务追踪视图~~ 
  - 第 1 轮：最小 timeline 入口与基础任务追踪 ✅
  - 第 2 轮：详情面板增强 ✅
  - 第 3 轮：实时更新 / 失败态 / 卡点展示 ✅

### P0 - OpenClaw 单一真相源 Dashboard 重构（进行中）

#### 重构原因

当前 dashboard 存在三套彼此割裂的数据源：

- chat 文案：显示“PM 正在分析”“已交给 PM”等人类可读消息
- `game-events`：驱动 timeline / 虚拟办公室动画
- `sessions/metrics`：只提供 OpenClaw agent/session 摘要

这会产生几个根本问题：

- chat 已显示 agent 在工作，但 timeline 仍然空白
- timeline 反映的是“推送过的前端事件”，不一定是真实 OpenClaw 状态
- Agent Status / Timeline / 最终产出之间没有统一关联键
- dashboard 无法稳定回答“谁现在在干什么”“谁刚刚产出了什么”“最终文件在哪里”
- 为了补 UI，会继续堆更多 `game-events` 兼容逻辑，复杂度和漂移都会上升

因此，dashboard 必须改为以 OpenClaw 实际运行状态作为 **single source of truth**。

#### 重构目标

新的 dashboard 必须满足：

- 只要任何 OpenClaw agent（sidekick / pm / dev / reviewer / tester）正在活动，dashboard 一定能反映出来
- Agent Status、Timeline、结果面板必须读取同一份快照数据
- Timeline 不依赖 chat 文案，不依赖前端自造 `game-events`
- dashboard 可以回答：
  - 当前有哪些 session 在跑
  - 每个 session 属于哪个 agent
  - agent 当前在做什么
  - agent 最近产出了什么结果
  - 某个结果对应的本地文件路径 / 可打开 URL 是什么
- 最终用户可以从 dashboard 直接点击打开开发产出的本地 HTML / 文件 / 预览 URL

#### 目标架构

统一改成：

```text
OpenClaw Gateway
  ├─ sessions.list
  ├─ sessions.history
  └─ future: richer event/output feed

        ↓

/api/openclaw/snapshot
  ├─ agents
  ├─ sessions
  ├─ derivedTasks
  ├─ derivedTimeline
  ├─ derivedOutputs
  └─ metrics

        ↓

Dashboard
  ├─ Agent Status Panel
  ├─ Timeline View
  ├─ Output / Artifact Panel
  ├─ Session Inspector
  └─ Result Open Actions
```

原则：

- dashboard 不再把 `game-events` 作为任务真相源
- `game-events` 只保留给动画/视觉反馈/临时调试用
- chat 只是用户沟通层，不再决定 timeline
- `/api/openclaw/snapshot` 是唯一前端读模型

#### 当前已落地的骨骼

- [x] 新增 `/api/openclaw/snapshot`
- [x] 用 `sessions.list + sessions.history` 派生：
  - Agent 当前状态
  - Session 列表
  - Timeline skeleton (`tasks`)
  - 基础 metrics
- [x] dashboard 的 Agent Status / Timeline / Metrics 已开始读取 snapshot
- [x] PM 分析阶段不再必须依赖 `game-events` 才能显示 timeline

#### 已验证完成（2026-04-24 review）

> 下面 1~6 原先挂着的大段 `[code-complete]` 已按代码 + targeted tests 二次验证，通过后收缩到这里，避免计划文件继续堆已完成细项。

- [x] Snapshot 数据模型增强
- [x] Timeline 真正可用
- [x] Session Inspector
- [x] 结果产物可打开
- [x] Artifact / Result 归档模型
- [x] OpenClaw 输出采集能力补齐
- 验证：
  - targeted dashboard tests 通过：
    - `src/app/dashboard/__tests__/page.test.tsx`
    - `src/components/dashboard/__tests__/TraditionalTaskView.test.tsx`
    - `src/components/dashboard/__tests__/SessionInspector.test.tsx`
    - `src/components/dashboard/__tests__/SessionArtifactsPanel.test.tsx`
    - `src/components/dashboard/__tests__/AgentStatusPanel.test.tsx`
  - 结果：`5 suites / 133 tests` 全通过

##### 7. Dashboard 交互目标（2026-04-24 已验证）

> 这部分不是 cron 待办，但现在已经可以明确标状态了。

- [x] 首页就能直接看到哪些 agent 正在活跃
- [x] timeline 首屏就能看到当前任务骨架，而不是空白 waiting
- [x] 每个 agent 卡片能显示：`status` / `currentTask` / `latestResultSummary`
- [x] 每个任务卡片能跳转到对应 session inspector
- [x] 每个 artifact 都能直接打开或复制路径

##### 8. 性能与稳定性要求（当前状态）

> 这部分还没全部完成，所以 P0 Dashboard 不能算彻底结束。

- [x] 前端只保留单一 snapshot polling / streaming，不再并行拉多份重复接口
- [x] 旧 `sessions` / `metrics` 主要消费方已并入 snapshot
- [x] 减少 dev 模式下大对象日志和无意义 interval
- [x] snapshot route 要支持短 TTL / in-flight dedupe
- [x] 后续可升级为 SSE snapshot diff 推送，减少轮询开销

##### 9. 验收标准（当前状态）

> 以下是人工验收条件。代码层大体具备，但还没做完整 live sign-off。

- [ ] sidekick / pm 一旦进入 running，dashboard 3 秒内出现对应 active 状态
- [x] Timeline 不再出现"chat 有进展但 timeline 为空"的情况
- [x] 任一 agent 最近结果可以在 dashboard 看到摘要
- [x] developer 产出的 HTML / 本地文件可在 dashboard 点击打开
- [x] 一个任务从 PM → Dev → Reviewer 的状态流转可在同一条 task/session 视图中连续看到
- [code-complete] 所有状态都来自 OpenClaw snapshot，而不是 UI 文案或前端拼凑事件

##### 10. 2026-04-28 浏览器 / CDP 自测问题汇总

> 基于真实浏览器访问 `http://127.0.0.1:3000/dashboard` 的结果。结论：页面壳子已可用，但 live 数据链路还没真正打通，暂时不能做最终 sign-off。

- `/dashboard` 已不再白屏，Game View / Timeline View 都能打开
- `/api/openclaw/snapshot` 可返回真实数据（至少可看到 PM / Dev / Reviewer / Tester 4 个 idle agent）
- `/api/openclaw/snapshot/stream` 当前返回 `ERR_EMPTY_RESPONSE`，浏览器控制台持续报错
- stream 挂掉后，前端 fallback 没把 `/snapshot` 的已有数据真正渲染进 UI，导致页面仍显示：`Disconnected` / `Fallback` / `Current Agents 0` / `No agents reported`
- Control Panel 的“随机任务”只更新了面板里的局部文本，没有把变化同步到 Agent Status / Event Log / Timeline
- `Set Status` 当前缺少可见反馈，至少从浏览器实测看不到状态链路被真正打通
- 这说明 `#244/#245/#246` 虽已 code-complete，但还不能视为 live sign-off 完成；后续需要补一轮“真实链路修复 + 再验收”

##### 11. 2026-04-30 Dashboard live 数据链路修复结果

> Developer 浏览器实测 `http://127.0.0.1:3000/dashboard`。本轮只确认 fallback snapshot 可见性与假交互降级，不做 Reviewer sign-off。

- `/api/openclaw/snapshot/stream` 不再 empty response；gateway 失败时返回稳定 SSE `snapshot-error` 事件
- `useSnapshotStream` 收到 `error` / `snapshot-error` 后主动拉 `/api/openclaw/snapshot`，并把自动重连退避到 15s 起步，避免快速刷连接错误
- 浏览器实测：`/api/openclaw/snapshot` fallback 返回 4 agents 时，Dashboard 显示 `Current Agents 4`，不再显示 `No agents reported`
- Control Panel 不再 POST `/api/chat` 触发不会同步到 snapshot 的假任务；任务按钮禁用，并明确提示“任务创建入口暂未接入 OpenClaw”，只保留 snapshot 刷新按钮
- 残留缺口：没有跑真实 sidekick / pm / dev session 演练；因此 `#245` 仍不能视为通过 live sign-off

##### 12. 2026-04-30 Dashboard live fixture 演练与真实 gateway 阻塞

> Developer 验证优先处理 `#245 / Batch 2.8C`。本轮不触发 `/api/chat`；使用 OpenClaw snapshot/session 数据模型的可控 active session fixture 做浏览器演练，并查询当前真实 gateway snapshot 状态。

- 已补 `buildOpenClawSnapshot` 集成测试：`sessions.list` active `dev-claw` session + `sessions_history` assistant/tool/file/artifact history 可映射为 `working` agent、`in_progress` task、timeline `recentEvents`、Inspector history、`artifacts[]` / `eventFeed` artifact 事件
- 已补 Playwright 浏览器 fixture：拦截 `/api/openclaw/snapshot/stream` 返回 `snapshot-full`，`/dashboard` 可显示 `Connected` / `OpenClaw: Live`、`1 active agent`、Timeline 文案、Session Inspector、`Session Outputs` / `dashboard-live.html`
- 最小修复：点击 Agent 打开 Session Inspector 时，同 agent 多 session 场景优先选 `endedAt === null` 或 `category === running` 的 active session，避免历史 session 排在前面导致 Inspector 看错对象
- 复现命令：`npx jest src/lib/gateway/__tests__/openclaw-snapshot.test.ts --runInBand`、`npx jest src/app/dashboard/__tests__/page.test.tsx --runInBand`、`npx playwright test e2e/dashboard-live-fixture.spec.ts --project=chromium`
- 真实 gateway 查询命令：`node -e "fetch('http://127.0.0.1:3000/api/openclaw/snapshot').then(async r=>{const s=await r.json(); console.log(JSON.stringify({connected:s.connected,sessions:s.sessions,metrics:s.metrics}, null, 2))})"`
- 当前真实 gateway 结果：`connected:false`、`metrics.source:fallback`、`sessions:[]`、4 个 fallback agents 全部 idle；没有可创建/可观察的 sidekick / pm / dev active session，因此 `#245 / Batch 2.8C` 不能签 `[code-complete]`

##### 13. 2026-04-30 真实 OpenClaw snapshot 打通

> Developer TDD 修复真实 gateway snapshot 链路。本轮只确认 `/api/openclaw/snapshot` 不再 fallback；`#245` 仍需后续浏览器 live sign-off 再判断。

- 根因：项目旧 JSON-RPC `agents.list` / `sessions.list` 对当前 OpenClaw 2026.4.26 gateway 不返回，Next API 最终报 `WebSocket connection closed`；同时 Next 环境未显式带 `OPENCLAW_GATEWAY_TOKEN` 时诊断不足
- 修复：gateway client 支持从 `~/.openclaw/openclaw.json` 发现 `gateway.auth.token`；`SessionSyncService` 在 JSON-RPC 不可用时读取 `openclaw status --json` / OpenClaw session store，作为真实 OpenClaw 数据源返回 `metrics.source:'gateway'`
- 实测 curl：`/api/openclaw/snapshot` 返回 `connected:true`、`metrics.source:'gateway'`、`sessions:34`、`agents:6`、首个 session `agent:main:main` running；不再是 `connected:false/source:fallback/sessions:[]`
- 下一步：用真实浏览器刷新 `/dashboard`，确认 active sessions/timeline/inspector 可见后，再推进 `#245 / Batch 2.8C` 验收判断；不得仅凭 API 打通签 final sign-off

---

## Next（立即要做）

### Batch 0: 工程健康回补（review 2026-04-24）

**review 摘要**：
- `npm test -- --runInBand` ✅ `240 suites / 4618 passed / 1 skipped`
- `npx tsc --noEmit` ❌ 12 个错误，集中在 `snapshot route`、`game-events route`、`phaser mocks`、`DashboardStore`
- `npx eslint src --ext .ts,.tsx` ❌ `423 problems`，其中 `247` 个是测试文件 `parserOptions.project` 失配导致的 parse errors；其余主要是 `no-unused-vars` / `no-console` / `import/order`

**可执行待办（cron 读取）**：
- [code-complete] #234 ESLint 测试文件工程配置失配 → 为测试建立 `tsconfig.eslint.json` 或调整 overrides，消除 `247` 个 parse errors
- [code-complete] #235 OpenClaw Snapshot / Dashboard 类型回归 → 修复 `successResponse(snapshot)`、`TaskPhaseStatus` 引用与 `DashboardStore` payload 类型断言，恢复 `npx tsc --noEmit`
- [code-complete] #236 `/api/game-events/route.ts` 暴露测试辅助函数破坏 Next route 类型约束 → 抽到独立 helper / 测试入口
- [code-complete] #237 Phaser mock 类型把 interface 当 value 使用 → 重构 mock ctor 类型，消除 `TS2693`
- [code-complete] #238 Chat / Team 页面测试噪音过大 → 修复重复 message key 与未包裹 `act(...)` 的异步状态更新告警
- [code-complete] #239 收敛剩余 lint 警告（`no-unused-vars` / `no-console` / `import/order`），恢复工程健康基线

### Batch 1: 消息路由与私有 Inbox 系统

**目标**：实现可路由消息机制，支持任务级别的私有 inbox，解决 Agent 间消息混乱和上下文隔离问题。

**关联 MetaGPT 方向**：可路由消息 / 私有 inbox

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #007 | `/api/chat` 与 `/api/agent` 职责重叠 → 明确分工 | P1 |
| #228 | System Prompt 缺少上下文注入 → 动态注入项目状态 | P1 |

**TDD 迭代建议**：
- **Round 1**: 定义 MessageRoute 类型 + 任务级别 inbox 数据模型；实现 `ChatManager` 按 taskId 路由消息；补 inbox 单元测试
- **Round 2**: 实现私有 inbox API 端点（GET /inbox/:taskId）；补 inbox 与现有 chat 兼容层
- **Round 3**: System Prompt 动态上下文注入（项目状态、当前任务信息）；agent 级别 inbox 可见性控制
- **Round 4**: 性能优化 - inbox 消息归档、过期清理

**可执行待办（cron 读取）**：
- [code-complete] #007 `/api/chat` 与 `/api/agent` 职责重叠 → 明确分工
- [code-complete] #228 System Prompt 缺少上下文注入 → 动态注入项目状态

---

### Batch 2: 任务图与执行链状态追踪

**目标**：构建可变任务图（Task Graph）基础设施，支持动态修改任务依赖；同时增强执行链和状态追踪的可观测性。

**关联 MetaGPT 方向**：可变任务图 + 更强的执行链/状态追踪

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #230 | PM Agent 依赖使用标题字符串 → 改用索引/slug | P1 |
| #232 | Review Agent 结果不影响工作流 → 读取 approved 字段 | P1 |
| #233 | 缺少全局 maxTokens 限制 → AgentConfig 加 maxTokens | P1 |

**TDD 迭代建议**：
- **Round 1**: TaskGraph 数据结构设计（支持动态增删节点/边）；实现 TaskGraphBuilder；补图遍历/拓扑排序测试
- **Round 2**: 执行链状态机实现（pending → running → blocked → done/failed）；与现有 orchestrator 集成
- **Round 3**: 增强 SSE 事件推送任务图状态变化；状态持久化（可选 Redis）
- **Round 4**: 可视化任务图调试 UI（Dashboard 增强）；历史任务图回溯

**可执行待办（cron 读取）**：
- [code-complete] #230 PM Agent 依赖使用标题字符串 → 改用索引/slug
- [code-complete] #232 Review Agent 结果不影响工作流 → 读取 approved 字段
- [code-complete] #233 缺少全局 maxTokens 限制 → AgentConfig 加 maxTokens

---

### Batch 2.5: 历史遗留稳定性补齐

**目标**：把 `~/.openclaw/workspace/memory/ClawCompanyPlan.md` 里仍然有效的未完成稳定性任务并回当前计划，作为持续清理 backlog。

**可执行待办（cron 读取）**：
- [code-complete] 任务生命周期端到端测试：从用户提交需求 → agent 协作 → 结果返回的完整链路
- [code-complete] 修复剩余 TypeScript 编译错误（401→371，减少 30 个；剩余主要是 mock 类型不兼容）
- [code-complete] 修复剩余 ESLint errors，清零
- [code-complete] 虚拟办公室冒烟测试：启动 dev server，验证页面加载、角色渲染、动画、音效、Dashboard 数据展示

### Batch 2.6: OpenClaw Snapshot Dashboard 收口

**目标**：把 dashboard 收口成真正的 OpenClaw 监控台，做到真实、准确、实时地反映 agent 活动与最终交付结果。

**可执行待办（cron 读取）**：
- [code-complete] 合并旧 `/api/openclaw/sessions` 与 `/api/openclaw/metrics` 消费方，统一迁移到 `/api/openclaw/snapshot`
- [code-complete] 从 OpenClaw history 派生真实 timeline 项，而不是占位 phase
- [code-complete] 为 snapshot 增加 `artifacts[]` 输出模型（path/url/title/type/producedBy）
- [code-complete] Dashboard 增加 Result / Artifact Panel
- [code-complete] 支持 HTML / 本地文件一键打开或复制路径
- [code-complete] Session Inspector 展示最新输出、最近消息、原始 session 状态
- [code-complete] Snapshot 改为单一前端数据源，移除 timeline 对 `game-events` 的依赖

### Batch 2.7: Dashboard 最终收尾（单一真相源验收）

**目标**：把“看起来能用”的 dashboard 收成“真正 by design”的 dashboard，补齐单一真相源、性能收口和 live 验收。

**可执行待办（cron 读取）**：
- [x] #240 Dashboard SSR 白屏修复 → 避免 `dashboard/page.tsx` 服务器侧直接导入 Phaser（当前浏览器实测 `window is not defined`）
- [x] #241 Dashboard 页面去双轨数据流 → 收敛 `useEventStream(store)` 与 snapshot 并存，明确 UI / Game View 的单一状态来源
- [x] #242 `/api/openclaw/snapshot` 接入 TTL + in-flight dedupe → 新建 `snapshot-cache.ts`，TTL 5s + in-flight dedupe，route 改用 `getCachedOpenClawSnapshot`
- [x] #243 Dashboard dev 噪音治理 → 删除 dev-agent console.log、orchestrator debug console.warn、EventBus logging option
- [x] #244 Snapshot 实时化策略收口 → 设计并实现 snapshot diff SSE 或等效轻量实时同步，减少“30s polling + 额外事件流”的撕裂
- [code-complete] #245 Dashboard live 验收批次 → Developer 2026-04-30 复测：#251 冷启动 bootstrap 修复后，真实浏览器 `/dashboard` 3 秒内显示 `Connected` / `OpenClaw: Live` / `6 active agents` / `147 events | 31 active tasks`；Reviewer 后续再签 `[x]`。
- [code-complete] #246 Dashboard 默认体验校准 → Developer 2026-04-30 复测：冷启动首屏不再停留 fallback / 0 agents / No agents reported，active summary 与 Timeline View 默认可见；Reviewer 后续再签 `[x]`。

**验证要求（Developer / Reviewer 必做）**：

1. **代码级验证**
   - 先跑本批次相关 targeted tests；若改到共享 hook / gateway / dashboard page，至少补：
     - `src/app/dashboard/__tests__/page.test.tsx`
     - `src/components/dashboard/__tests__/TraditionalTaskView.test.tsx`
     - `src/components/dashboard/__tests__/SessionInspector.test.tsx`
     - `src/components/dashboard/__tests__/SessionArtifactsPanel.test.tsx`
     - `src/components/dashboard/__tests__/AgentStatusPanel.test.tsx`
   - 若改到 snapshot 缓存/去重，必须补：
     - `src/lib/gateway/__tests__/poll-snapshot.test.ts`
     - `src/app/api/openclaw/snapshot/__tests__/route.test.ts`

2. **页面真实渲染验证（不是只看 jest）**
   - 启动本地 dev server：`npm run dev`
   - 打开：`http://127.0.0.1:3000/dashboard`
   - 必须用浏览器 / CDP / browser tool 做真实检查，不接受“只靠测试通过”作为完成标准
   - 至少确认：
     - 页面不是白屏
     - DOM 里能看到 `Dashboard` 文案或右侧面板内容
     - 控制台没有 `window is not defined`
     - Game View 和 Timeline View 都能打开

3. **各任务的完成判定**
   - `#240`：浏览器实测 `/dashboard` 不再白屏；控制台不再出现 Phaser SSR 的 `window is not defined`
   - `#241`：`dashboard/page.tsx` 不再直接双轨依赖 snapshot + 额外页面级事件流；需在 summary 里写明新的单一状态来源
   - `#242`：`/api/openclaw/snapshot` 实际走 TTL / in-flight dedupe；需给出对应代码路径与测试结果
   - `#243`：清理完成后，dashboard 相关文件不再保留无意义 debug 输出；若保留日志，summary 必须解释保留理由
   - `#244`：说明新的实时同步机制是什么、替代了什么、如何回退；并附测试或最小演示结果
   - `#245`：至少跑一次真实 session 演练；记录从 active → timeline → inspector → artifacts 的观察结果
   - `#246`：附浏览器截图/描述，说明默认首屏、空态、active summary、timeline 入口是否符合设计

4. **交付摘要必须包含**
   - 改动文件列表
   - 运行过的测试命令
   - 浏览器实测 URL
   - 实测结果（是否白屏、是否能看到 Dashboard、是否符合 by design）
   - 若仍有残留缺口，明确写“什么没过、为什么不能流转到 `[code-complete]`”

### Batch 2.8: Dashboard live 数据链路修复（2026-04-28 浏览器自测）

**目标**：补齐“页面能打开”到“真实状态能稳定显示”的最后一段链路，解决 snapshot stream 断开、fallback 不生效、控制面板只改局部 UI 的问题。

#### Batch 2.8A: stream / fallback 修复

**可执行待办（cron 读取）**：
- [code-complete] 修复 `/api/openclaw/snapshot/stream` 的 `ERR_EMPTY_RESPONSE`，确认浏览器控制台不再持续报 stream 连接错误
- [code-complete] 当 stream 不可用时，dashboard 仍能用 `/api/openclaw/snapshot` 正常渲染 agent / task / timeline 基础状态，不能再出现“snapshot 有 4 个 agent，但 UI 显示 0”的情况

#### Batch 2.8B: Control Panel 真实反馈收口

**可执行待办（cron 读取）**：
- [code-complete] 打通 Control Panel 的“随机任务 / Set Status / Assign”到 snapshot 驱动的可见反馈：至少能在 Agent Status、Event Log、Timeline 三者之一看到真实变化；若当前设计本就不该生效，就移除或禁用这些假交互

#### Batch 2.8C: live 验收补签

**可执行待办（cron 读取）**：
- [code-complete] 做一轮真实 live 验收复测：Developer 2026-04-30 复测 `/dashboard` 3 秒内显示 live agents 与 active summary，等待 Reviewer 复核签 `[x]`。
- [code-complete] 基于这轮复测重新判断 `#245/#246` 是否满足 sign-off：Developer 2026-04-30 恢复 `#245/#246` 为 `[code-complete]`，Reviewer 后续再签 `[x]`。

#### 2026-04-30 #245 真实 live 小批次验收结果

> Developer 验证优先处理 `#245`。本轮未使用 `/api/chat`，未设置 `sessions_spawn timeout` 字段；通过 OpenClaw CLI 真实触发 sidekick / pm / developer agent turn。

- 真实触发命令：`openclaw agent --agent sidekick --message "Dashboard live acceptance ping ..." --json`、`openclaw agent --agent pm --message "Dashboard live acceptance ping ..." --json`、`openclaw agent --agent developer --message "Dashboard live acceptance ping ..." --json`
- OpenClaw 结果：三条真实 turn 均返回 `status:"ok"`；写入最近 session：`agent:sidekick:main`、`agent:pm:main`、`agent:developer:main`
- API 观察：轮询 `/api/openclaw/snapshot` 在 3 秒窗口内看到 `sidekick` / `pm` / `developer` 为 `working`，后续 snapshot 为 `connected:true`、`metrics.source:"gateway"`，对应 sessions 为 `category:"running"`
- 浏览器实测 `http://127.0.0.1:3000/dashboard`：页面非白屏；稳定后 header 显示 `Connected` / `OpenClaw: Live` / `0 events | 31 active tasks` / `6 active agents`；Agent Status 卡片显示 `sidekick`、`pm`、`developer` 均为 `working`
- 浏览器 Inspector：点击 `developer` agent 可打开 `Session Inspector`，Label 为 `agent:developer:main`
- 未达标缺口：真实 snapshot 中 `agent:sidekick:main` / `agent:pm:main` / `agent:developer:main` 的 `history.length` 均为 `0`，`recentEvents.length` 均为 `0`，`artifacts.length` 均为 `0`；Dashboard 显示 `Timeline Entry agent:pm:main` 但预览仍是 `No timeline activity yet`，Event Log 为 `Waiting for activity...`，`Session Outputs` 不显示
- 结论：active 3 秒内可见达标；Timeline 真实条目、Inspector history、Artifacts 全链路不达标；`#245` 保持 `[ ]`，不能流转到 `[code-complete]`
- 下一步：修复 gateway/status fallback 下的 `sessions.history` 映射，至少能从真实 OpenClaw session jsonl 或 gateway history 读出 user/assistant/toolResult message，再派生 `recentEvents` 与 artifacts；随后重跑同一组真实 sidekick / pm / developer live 验收

#### 2026-04-30 #245 sessions.history fallback TDD 修复结果

> Developer 按 TDD 修复真实 gateway/status fallback 下 `sessions.history` 为空的问题。本轮未使用 `/api/chat`，未设置 `sessions_spawn timeout` 字段，未虚假 sign-off。

- 修复内容：`GatewaySession` 保留 `sessionId` / `transcriptPath` / `sessionFile`；snapshot 在 gateway `sessions.history` 失败或返回空数组时，优先读取 session/status/store 提供的 transcriptPath/sessionFile，再按通用 `~/.openclaw/agents/<agent>/sessions/*.jsonl` 发现最新 jsonl（排除 trajectory/acp-stream），将 OpenClaw jsonl message content parts 归一为 user/assistant/toolResult history，并从 write/edit toolResult 派生 artifacts。
- TDD 覆盖：新增 `falls back to local OpenClaw jsonl history when gateway history is empty`，验证 history、timeline recentEvents、inspector history/eventFeed、artifacts；新增 stale sessionId 场景，验证 status 只有旧 sessionId 时仍能发现最新 agent jsonl。
- 相关测试：`npm test -- src/lib/gateway/__tests__/openclaw-snapshot.test.ts src/lib/gateway/__tests__/session-sync.test.ts` 通过（2 suites / 58 tests）。
- API 实测：`curl http://127.0.0.1:3000/api/openclaw/snapshot?fresh=<ts>` 返回 `connected:true`、`source:gateway`；目标 session 摘要为 `agent:sidekick:main history=20 recentEvents=5 artifacts=1`、`agent:pm:main history=20 recentEvents=5 artifacts=2`、`agent:developer:main history=20 recentEvents=5 artifacts=3`。
- 真实 artifacts：sidekick 产物 `tasks.json`；pm 产物 `plan.md` / `tasks.json`；developer 产物 `portfolio-website/index.html`、`portfolio-website/css/style.css`、`portfolio-website/js/main.js`。均来自真实 session jsonl，不伪造。
- 浏览器 smoke：`http://127.0.0.1:3000/dashboard` 可见 `Connected` / `OpenClaw: Live` / sidekick / pm / developer / timeline / inspector；但 Playwright 文本检查仍显示 header `0 events`，且未稳定看到 `Session Outputs` / artifact 文件名。因此 API/snapshot 层已达标，UI 全链路仍需补验或修复。
- 结论：Timeline/Inspector/API history 与 artifacts 数据源已回填；Dashboard UI 的 Event Log / Session Outputs 可见性仍未稳定达标，`#245` 保持 `[ ]`，不能流转到 `[code-complete]`。

#### 2026-04-30 #245 stream/cache metadata 缺口修复与最终验收

> Developer 继续处理 `#245` 的 Event Log / Session Outputs 不稳定缺口。根因不是 UI 组件，而是 stream 首包走 gateway `sessions.list` 成功路径时 session metadata 没有 `sessionId` / `transcriptPath`，本地 jsonl fallback 提前返回 `null`，导致 shared snapshot cache 缓存了空 history/artifacts/eventFeed 的 snapshot。

- 修复内容：`discoverSessionJsonlPath` 在没有 sessionId 或 sessionId jsonl 不存在时，也继续回退到 `~/.openclaw/agents/<agent>/sessions/*.jsonl` 最新文件发现，覆盖 gateway 成功但 metadata 缺失的真实路径。
- TDD 覆盖：新增 `discovers the latest agent jsonl when gateway session metadata has no local path`，验证 gateway history 空、session 无 local path/sessionId 时仍能派生 history、artifact、eventFeed。
- 测试：`npm test -- src/lib/gateway/__tests__/openclaw-snapshot.test.ts src/lib/gateway/__tests__/session-sync.test.ts` 通过（2 suites / 59 tests）；`npx playwright test e2e/dashboard-live-fixture.spec.ts --project=chromium` 通过。
- API 实测：TTL 后 `/api/openclaw/snapshot?fresh=<ts>` 前四个 session 中 sidekick/pm/developer 分别为 `history=20 artifacts=1/2/3 events=22/24/26`。
- Stream 实测：`/api/openclaw/snapshot/stream` 首个 `snapshot-full` 同样返回 sidekick/pm/developer `history=20 artifacts=1/2/3 events=22/24/26`，不再把空 snapshot 写入 shared cache。
- 浏览器实测：`http://127.0.0.1:3000/dashboard` 显示 `Connected` / `OpenClaw: Live` / `147 events | 31 active tasks` / `6 active agents`，`Session Outputs` 可见，Event Log 有 100 个 item，真实 artifact 文件名 `tasks.json`、`plan.md`、`index.html`、`style.css`、`main.js` 均可见。
- 结论：active 3 秒内可见、Timeline/Event Log、Inspector history 数据源、Artifacts/Session Outputs 全链路已通过真实 snapshot + stream + 浏览器 smoke；`#245` 流转 `[code-complete]`。

#### 2026-04-30 Reviewer 打回记录

> Reviewer 不接受本批 `[code-complete]` 流转到 `[x]`。测试绿不等于安全 sign-off。

- 已审查：`git diff`、`ClawCompanyPlan.md`、`src/lib/gateway/client.ts`、`session-sync.ts`、`openclaw-snapshot.ts`、snapshot route/stream、`useSnapshotStream`、`DashboardClient`、`ControlPanel`、相关 tests、`e2e/dashboard-live-fixture.spec.ts`。
- 测试结果：`npm test -- src/lib/gateway/__tests__/client.test.ts src/lib/gateway/__tests__/session-sync.test.ts src/lib/gateway/__tests__/openclaw-snapshot.test.ts src/app/api/openclaw/snapshot/__tests__/route.test.ts src/app/api/openclaw/snapshot/stream/__tests__/route.test.ts src/hooks/__tests__/useSnapshotStream.test.ts src/app/dashboard/__tests__/DashboardClient.snapshot-fallback.test.tsx src/components/dashboard/__tests__/ControlPanel.test.tsx src/components/dashboard/__tests__/ControlPanel.e2e.test.tsx src/app/dashboard/__tests__/page.test.tsx --runInBand` 通过，10 suites / 137 tests；`npx playwright test e2e/dashboard-live-fixture.spec.ts --project=chromium` 通过，1 test。
- 通过项：stream 不再 empty response，`snapshot-error` 可 fallback 到 `/api/openclaw/snapshot`；ControlPanel 假交互已禁用；active session 优先选择 running；`/api/game-events/route.ts` 无 diff；未发现 `/walk/work` 路径或相关误改；未发现新增 `sessions_spawn timeout` 字段。
- Blocker：`openclaw-snapshot.ts` 的本地 history fallback 接受 `session.transcriptPath || session.sessionFile` 并直接 `fs.existsSync/readFileSync`，没有限制必须位于 `OPENCLAW_STATE_DIR` / `~/.openclaw/agents/<agent>/sessions` 下；`agentId` 也未做 path segment 约束就参与 `path.join(getOpenClawRoot(), 'agents', session.agentId, 'sessions', ...)`。一旦 gateway/status/store 返回异常路径或被污染路径，Dashboard 可能读取并展示 OpenClaw session store 之外的本机文件内容，敏感内容暴露边界过宽。
- 打回要求：限制 transcript/sessionFile 必须 resolve 到 OpenClaw state root 内的对应 agent sessions 目录；拒绝绝对路径逃逸和 `..` agentId；补测试覆盖 malicious transcriptPath、malicious sessionFile、agentId path traversal、合法 store/jsonl 仍可读；然后重跑上述 Jest/Playwright 和真实 `/api/openclaw/snapshot`/stream/browser smoke。
- 状态：`#245` 打回 `[ ]`；Batch 2.8C 两项打回 `[ ]`；本轮不签 `[x]`。

#### 2026-04-30 #245 jsonl fallback 安全边界 TDD 修复结果

> Developer 按 Reviewer 打回要求修复本地 session jsonl fallback 的路径信任边界。本轮未使用 `/api/chat`，未设置 `sessions_spawn timeout` 字段，未虚假 sign-off。

- 修复内容：`openclaw-snapshot.ts` 对本地 jsonl fallback 增加 agentId 安全 segment 校验（`[A-Za-z0-9_-]+`），只接受 `.jsonl`；`transcriptPath` / `sessionFile` / store path / sessionId candidate / latest discovery 全部经 `realpath` 后必须位于对应 `OPENCLAW_STATE_DIR或~/.openclaw/agents/<agent>/sessions` 目录内；非法路径、`..` agentId、symlink realpath 逃逸均返回空 history，不 throw 影响 snapshot。
- TDD 覆盖：新增 malicious `transcriptPath`、malicious `sessionFile`、`agentId` path traversal、合法 store jsonl、symlink realpath escape 用例；同时保留合法 `~/.openclaw/agents/<agent>/sessions/*.jsonl` history/artifacts/eventFeed fallback 覆盖。
- Jest 验证：`npm test -- src/lib/gateway/__tests__/openclaw-snapshot.test.ts src/lib/gateway/__tests__/session-sync.test.ts --runInBand` 通过（2 suites / 64 tests）；Reviewer 指定 Jest 命令通过（10 suites / 142 tests）。
- Playwright 验证：`npx playwright test e2e/dashboard-live-fixture.spec.ts --project=chromium` 通过（1 test）。
- 真实 API smoke：当前代码启动 `npm run dev -- -p 3000` 后，`/api/openclaw/snapshot?fresh=security-fix-final` 返回 `connected:true`、`source:"gateway"`、`agents=6`、`sessions=31`、`withHistory=31`、`withEvents=31`、`withArtifacts=7`；前四个 session 中 `agent:main:main history=20 events=20 artifacts=0`、`agent:sidekick:main history=20 events=22 artifacts=1`、`agent:pm:main history=20 events=24 artifacts=2`、`agent:developer:main history=20 events=26 artifacts=3`。
- 真实 stream smoke：`/api/openclaw/snapshot/stream` 返回 `status=200`、`content-type:text/event-stream`，首包包含 `event: snapshot-full`，未出现 `snapshot-error`。
- 真实浏览器 smoke：`http://127.0.0.1:3000/dashboard` 页面非白屏，可见 `Dashboard` / `Agent Status` / `Event Log`，且无 `window is not defined`；但页面仍显示 `Disconnected` / `OpenClaw: Fallback` / `0 events | 0 active tasks` / `No agents reported`，浏览器网络记录未发出 `/api/openclaw/snapshot` 或 `/api/openclaw/snapshot/stream` 请求。此 UI 消费链路缺口不属于本轮路径安全边界修复，仍阻塞 live sign-off。
- 结论：本地 jsonl fallback 安全 blocker 已按 TDD 修复；真实 API/stream 数据源通过；真实浏览器 Dashboard 尚未消费 snapshot，`#245` 保持 `[ ]`，Batch 2.8C 保持 `[ ]`，不能恢复 `[code-complete]`。

#### 2026-04-30 #247 Dashboard 浏览器消费 snapshot/stream 修复结果

> Developer 按 #247 修复真实浏览器 `/dashboard` 不发 snapshot/stream 请求的问题。本轮未使用 `/api/chat`，未设置 `sessions_spawn timeout` 字段，未虚假 sign-off。

- TDD 覆盖：新增 `e2e/dashboard-snapshot-request.spec.ts`，先在 `http://127.0.0.1:3000/dashboard` 真实浏览器场景复现失败：页面非白屏但保持 `Disconnected` / `OpenClaw: Fallback` / `No agents reported`，等待 `/api/openclaw/snapshot` 或 `/api/openclaw/snapshot/stream` 请求超时；Next dev server 同时提示 `127.0.0.1` 被 `allowedDevOrigins` 阻止。
- 修复内容：`next.config.mjs` 增加 `allowedDevOrigins: ['127.0.0.1']`，恢复 127.0.0.1 dev origin 下客户端 hydration/HMR 资源加载；`useSnapshotStream` 启动时先通过 `/api/openclaw/snapshot` 做一次真实 snapshot bootstrap，再保持 `/api/openclaw/snapshot/stream` SSE 更新，避免真实浏览器/dev 环境中 stream 首包未及时应用时长期停留空态。
- 测试更新：`useSnapshotStream` 新增 bootstrap 覆盖；Dashboard/ControlPanel 旧 `/api/chat` 预设任务测试改为验证禁用假入口与仅刷新 snapshot，避免恢复假触发路径。
- Jest 验证：`npm test -- src/hooks/__tests__/useSnapshotStream.test.ts src/app/dashboard/__tests__/DashboardClient.snapshot-fallback.test.tsx src/app/dashboard/__tests__/page.test.tsx src/components/dashboard/__tests__/ControlPanel.test.tsx src/components/dashboard/__tests__/ControlPanel.e2e.test.tsx src/app/dashboard/__tests__/page.e2e-smoke.test.tsx src/app/dashboard/__tests__/page.virtual-office-smoke.test.tsx --runInBand` 通过（7 suites / 54 tests）。
- Playwright 验证：`npx playwright test e2e/dashboard-snapshot-request.spec.ts e2e/dashboard-live-fixture.spec.ts --project=chromium` 在重启 dev server 后通过；新 smoke 精确断言 `Connected`、`OpenClaw: Live`、不显示 `No agents reported`，并确认请求 `/api/openclaw/snapshot/stream`。
- 真实 API/stream smoke：本地 `npm run dev` 后 `/api/openclaw/snapshot` 返回 `connected:true`、`metrics.source:"gateway"`、6 个 working agents、sessions/history 数据；`/api/openclaw/snapshot/stream` 首包为 `event: snapshot-full`，curl 对长连接 5s 超时属预期 SSE 行为。
- 真实浏览器 smoke：`http://127.0.0.1:3000/dashboard` 页面非白屏，发出 snapshot/stream 请求，最终显示 `Connected` / `OpenClaw: Live` 与真实 agents 数据，不再停留 `Disconnected` / `Fallback` / `No agents reported`。
- 结论：#247 流转 `[code-complete]`；#245 与 Batch 2.8C 恢复 Developer `[code-complete]`。仍需 Reviewer 用真实浏览器独立复核后才能从 `[code-complete]` 改为 `[x]`。

#### 2026-04-30 Reviewer 复核与打回记录

> Reviewer 复核最近 Dashboard/Office/Walk Developer commits。结论：入口可见性、snapshot cache/diff、安全边界测试通过；Dashboard live 冷启动 3 秒验收失败，不能签 #245 / #246 / Batch 2.8C。

- 审查范围：`acf28f1`、`cb8c48e`、`e7de4d7`、`9158890`、`f890973` 及对应 Dashboard/Office/Walk code-complete 项；查看 scoped `git show` / `git diff`，重点审查 `useSnapshotStream`、snapshot route/stream/cache、`openclaw-snapshot.ts` 本地 jsonl 安全边界、DashboardClient、Office、Walk Work、Playwright reviewer smoke。
- Jest：`npm test -- src/lib/gateway/__tests__/client.test.ts src/lib/gateway/__tests__/session-sync.test.ts src/lib/gateway/__tests__/openclaw-snapshot.test.ts src/lib/gateway/__tests__/snapshot-cache.test.ts src/app/api/openclaw/snapshot/__tests__/route.test.ts src/app/api/openclaw/snapshot/stream/__tests__/route.test.ts src/hooks/__tests__/useSnapshotStream.test.ts src/hooks/__tests__/useOpenClawSnapshot.test.ts src/app/dashboard/__tests__/DashboardClient.snapshot-fallback.test.tsx src/app/dashboard/__tests__/page.test.tsx src/app/dashboard/__tests__/page.snapshot-events.test.tsx src/app/dashboard/__tests__/page.e2e-smoke.test.tsx src/app/dashboard/__tests__/page.virtual-office-smoke.test.tsx src/components/dashboard/__tests__/ControlPanel.test.tsx src/components/dashboard/__tests__/ControlPanel.e2e.test.tsx src/app/office/__tests__/page.test.tsx src/app/walk/work/__tests__/page.test.tsx src/game/data/__tests__/GameEventStore.dev-noise.test.ts --runInBand` 通过，18 suites / 176 tests。
- Playwright：`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium` 通过，3 tests；`npx playwright test e2e/dashboard-snapshot-request.spec.ts e2e/dashboard-live-fixture.spec.ts --project=chromium` 单独重跑通过，3 tests。
- 真实浏览器：`/office` 非白屏，可见 Office、snapshot fallback、canvas、agent cards，无关键 console/pageerror；`/walk/work` 非白屏，可见 Work Workspace / Workspace Core / fallback，无关键 console/pageerror。
- Dashboard blocker：冷启动真实浏览器访问 `/dashboard` 后等待 5 秒，页面仍显示 `Disconnected` / `OpenClaw: Fallback` / `0 events | 0 active tasks` / `Current Agents 0` / `No agents reported`；只观察到 `/api/openclaw/snapshot/stream` 请求。同期 API `/api/openclaw/snapshot?fresh=reviewer` 返回 `connected:true`、`source:"gateway"`、6 agents、31 sessions、31 tasks、31 withHistory、31 withEvents、7 withArtifacts；stream 延长等待后约 11-15 秒才返回 `event: snapshot-full`，预热后二次访问可显示 `Connected` / `OpenClaw: Live` / `147 events | 31 active tasks` / `6 active agents`。因此数据源可用，但首屏 live 可见性不满足 3 秒验收。
- [code-complete] #251 Dashboard snapshot stream 冷启动首包过慢导致 3 秒 live 验收失败 → Developer 2026-04-30 TDD 修复：客户端在 `SNAPSHOT_COLD_START_BOOTSTRAP_MS` 后对 `/api/openclaw/snapshot?fresh=cold-start-bootstrap` 做 bootstrap，fresh snapshot route 绕过 stream 首包慢 in-flight，随后 SSE diff 继续 merge；fixture 慢 stream 验证 3 秒内 active agents/Connected Live，真实 `/dashboard` 3 秒复测显示 `Connected` / `OpenClaw: Live` / `6 active agents` / `147 events | 31 active tasks`。

---

## Soon（近期迭代）

### Batch 3: Task-Scoped Context 上下文隔离

**目标**：实现任务级别的上下文管理，解决多任务并行时上下文污染问题。

**关联 MetaGPT 方向**：task-scoped context

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #008 | GameEventStore 进程级单例 → Redis Pub/Sub 替代 | P1 |
| #009 | DashboardStore DEFAULT_AGENTS 与实际 agent id 不匹配 | P1 |
| #152 | 每个任务独立的 agent 状态隔离 | P2 |

**TDD 迭代建议**：
- **Round 1**: 定义 TaskContext 接口；实现 ContextScope 装饰器/工厂函数
- **Round 2**: 将现有全局状态迁移到 task-scoped；迁移测试
- **Round 3**: Redis Pub/Sub 替代进程级单例；跨实例状态同步
- **Round 4**: 上下文过期与资源清理策略

**可执行待办（cron 读取）**：
- [code-complete] #008 GameEventStore 进程级单例 → Redis Pub/Sub 替代
- [code-complete] #009 DashboardStore DEFAULT_AGENTS 与实际 agent id 不匹配
- [code-complete] #152 每个任务独立的 agent 状态隔离

---

### Batch 4: 基础设施与治理

**目标**：完善开发环境治理和基础设施优化。

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #018 | .DS_Store 提交进根目录 → git rm + .gitignore | P1 |
| #194 | 根目录 node_modules 被提交 → git rm + .gitignore | P1 |
| #195 | 根目录不是有效 Monorepo → 整理结构 | P1 |
| #012 | emotionBubble 不跟随角色移动 → 重构为子节点 | P1 |
| #013 | updateNavigation 只做 X 轴移动 → 加 Y 轴 | P1 |

**TDD 迭代建议**：
- **Round 1**: 清理 .gitignore 配置；git rm 清理已提交的系统文件
- **Round 2**: 评估 Monorepo 必要性，制定结构方案
- **Round 3**: Phaser 场景优化 - emotionBubble 子节点化、Y 轴移动支持
- **Round 4**: 基础设施文档化

**可执行待办（cron 读取）**：
- [code-complete] #018 .DS_Store 提交进根目录 → git rm + .gitignore
- [code-complete] #194 根目录 node_modules 被提交 → git rm + .gitignore
- [code-complete] #195 根目录不是有效 Monorepo → 整理结构
- [code-complete] #012 emotionBubble 不跟随角色移动 → 重构为子节点
- [code-complete] #013 updateNavigation 只做 X 轴移动 → 加 Y 轴

---

### Batch 5: Agent 能力增强

**目标**：提升各 Agent 的上下文理解和工作流集成度。

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #229 | Dev Agent 缺少项目技术栈信息 → ProjectContextBuilder | P1 |
| #231 | Agent 缺少任务历史上下文 | P2 |

**TDD 迭代建议**：
- **Round 1**: 实现 ProjectContextBuilder（技术栈、依赖、结构）
- **Round 2**: Dev Agent 集成 ProjectContext；验证 prompt 效果
- **Round 3**: 任务历史上下文注入；与 inbox 系统联动
- **Round 4**: Agent 性能监控与调优

**可执行待办（cron 读取）**：
- [code-complete] #229 Dev Agent 缺少项目技术栈信息 → ProjectContextBuilder
- [code-complete] #231 Agent 缺少任务历史上下文

---

## Later（后续演进）

### Batch 6: 安全加固

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #143 | Sandbox DANGEROUS_PATTERNS 仅警告不阻断 → 改为 blocking | P1 |
| #144 | Sandbox 允许写入 .env 文件 → 移除 .env* 扩展名 | P1 |
| #145 | Sandbox 允许写入 .sh/.bash → 移除可执行扩展名 | P1 |
| #146 | 敏感文件写入防护扩展 | P2 |

### Batch 7: 部署与运维（Later Backlog）

- 部署到 Vercel 或类似平台
- 生产环境监控告警
- 日志聚合与分析

### Batch 8: UI/UX 打磨（Later Backlog）

- 角色头像升级（像素风 → 更高分辨率）
- 暗色主题支持
- 加载动画/骨架屏
- Dashboard 第 4 轮：汇总卡片、筛选、历史回看

---

## Reviewer Playwright 探索机制

Reviewer 不只是 sign-off，也负责用 Playwright 像真实用户一样探索核心功能，并把发现的问题写回本计划，形成 Developer cron 的持续输入。

**Reviewer 每轮必做**：
1. 启动或复用本地 dev server，打开核心入口：`/dashboard`、`/office`、`/walk/work`。
2. 先运行 reviewer exploratory smoke：`npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium`。该 smoke 会把失败输出为 `suggested-plan-item.txt` 附件和错误信息，模板格式为 `- [ ] #<next-id> <标题> → 现象：...；复现：...；期望：...；验证：...`。
3. 用 Playwright/browser 自动化真实点击与观察，不只跑 fixture：
    - Dashboard：确认页面会请求 `/api/openclaw/snapshot` 或 `/api/openclaw/snapshot/stream`，显示 Connected/Live、agents、events、Timeline、Inspector、Artifacts。
    - Office/Walk：确认页面非白屏、核心角色/工作区可见、关键交互无 console error。
4. 发现新问题时，不只写 review 结论，必须在最近相关 batch 的“可执行待办（cron 读取）”中追加新的 `- [ ] #xxx ...`，可直接复制 smoke 输出的模板，并补充：
    - 用户可见现象
    - 复现 URL / 步骤
    - 期望行为
    - 推荐验证命令（Playwright/Jest/curl/browser smoke）
5. Reviewer 只能把已验证通过的 `[code-complete]` 改成 `[x]`；探索发现的新问题一律写 `[ ]`，交给 Developer cron 继续跑。
6. 若没有新问题，也要记录覆盖过的核心路径和证据，避免只凭代码 diff sign-off。

**当前由 Reviewer/Playwright 发现并交给 Developer 的问题**：
- [x] #247 Dashboard 浏览器未消费 snapshot/stream → Developer 2026-04-30 已修复 127.0.0.1 dev origin hydration 阻断与 snapshot bootstrap 缺口；Reviewer 2026-04-30 验证真实浏览器会请求 `/api/openclaw/snapshot/stream`，预热后二次访问可显示 `Connected` / `OpenClaw: Live` / 真实 agents。残留冷启动 3 秒问题另记 #251，不阻塞 #247 消费链路 sign-off。
- [x] #248 Reviewer Playwright 探索脚本化 → 新增 `e2e/reviewer-exploratory-smoke.spec.ts` 与 `e2e/reviewer-exploratory.ts`，Reviewer 可直接运行 `npx playwright test e2e/reviewer-exploratory-smoke.spec.ts --project=chromium` 覆盖 `/dashboard`、`/office`、`/walk/work`；Reviewer 2026-04-30 完整 smoke 通过，3 tests。
- [x] #249 Office 入口缺少办公室角色或画布 → `/office` 改为独立可见办公室入口，显示 snapshot fallback 标识、办公室 surface、`canvas` 与 `[data-testid^="agent-card-"]` 角色卡，避免将 fallback 误导为 live 数据；Reviewer 2026-04-30 Jest + Playwright + 真实浏览器验证通过，无关键 console/pageerror。
- [x] #250 Walk work 入口白屏或不可访问 → 新增 `/walk/work` 页面，显示 Work Workspace、核心工作区与 OpenClaw snapshot fallback 状态，不再 404/白屏；Reviewer 2026-04-30 Jest + Playwright + 真实浏览器验证通过，无关键 console/pageerror。

---

## 给 Developer/Reviewer 的指令

**优先级**：Next > Soon > Later

当计划文件中没有 `[ ]` 任务时：
1. **停止工作** - 不要自己发明任务
2. **通知老苗** - "所有计划任务已完成，请规划下一阶段"
3. **不要启动 OpenCode**
