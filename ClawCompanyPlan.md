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

#### 下一阶段必须补齐的功能

##### 1. Snapshot 数据模型增强

- [code-complete] 为每个 session 增加稳定字段：
  - `sessionKey`
  - `agentId`
  - `agentName`
  - `role`
  - `label`
  - `status`
  - `startedAt`
  - `endedAt`
- [code-complete] 为每个 session 派生当前工作说明：
  - `currentWork`
  - `latestThought`
  - `latestResultSummary`
- [code-complete] 为每个 session 派生输出产物：
  - `artifacts[]`
  - `artifact.type`
  - `artifact.path`
  - `artifact.url`
  - `artifact.title`
  - `artifact.producedBy`
  - `artifact.producedAt`
- [code-complete] 区分：
  - 正在运行的 session
  - 刚完成的 session
  - 失败的 session
  - 沉默/卡住的 session

##### 2. Timeline 真正可用

- [code-complete] 从 OpenClaw session/history 派生真实 timeline，而不是 phase 占位骨架
- [code-complete] Timeline 每张卡至少展示：
  - 当前 owner agent
  - 当前状态
  - 最新输出摘要
  - 最近更新时间
  - 对应 sessionKey
- [code-complete] 支持“谁在 work / 谁已完成 / 谁失败 / 谁卡住”筛选
  - [code-complete] 支持按 agent 分组查看当前任务

##### 3. Session Inspector

- [code-complete] 点击 agent / timeline task 后，右侧出现 Session Inspector
- [code-complete] 展示最近 history 消息
- [code-complete] 展示最后一条 assistant 输出
- [code-complete] 展示最后一条 tool / file / result 信息
- [code-complete] 展示当前 session 原始状态，方便 debug

##### 4. 结果产物可打开

这是最终体验里非常关键的一块：

- [code-complete] 如果 developer 产出了 HTML / 页面文件，dashboard 必须显示“打开结果”按钮
- [code-complete] 对每个 artifact 提供：
  - 本地文件路径（绝对路径或 workspace 相对路径）
  - 浏览器可打开 URL（如果能预览）
  - 来源 agent
  - 生成时间
- [code-complete] 支持最小打开动作：
  - `Open File`
  - `Open in Browser`
  - `Copy Path`
- [code-complete] 需要建立 artifact 发现机制：
  - 来自 OpenClaw history 里的文件输出
  - 或由 orchestrator / file writer 明确上报结果文件

##### 5. Artifact / Result 归档模型

- [code-complete] 定义 `ResultArtifact` 类型
- [code-complete] 对常见结果类型分类：
  - `html`
  - `tsx`
  - `image`
  - `markdown`
  - `json`
  - `test-report`
  - `url`
- [ ] dashboard 可以按最近结果排序展示
- [ ] 一个 session 完成后，能够追溯“这次最终交付了哪些文件”

##### 6. OpenClaw 输出采集能力补齐

如果仅靠当前 `sessions.list + sessions.history` 无法拿到足够丰富的输出，需要补 gateway / agent 侧能力：

- [ ] 增加更丰富的 OpenClaw event/output feed
- [ ] 支持 history 中返回 tool / file / artifact 元数据
- [ ] 支持将“最终产物路径 / URL”作为结构化字段回传
- [ ] 支持把 agent 的最终结果摘要结构化，而不是只靠自然语言解析

##### 7. Dashboard 交互目标

- [ ] 首页就能直接看到哪些 agent 正在活跃
- [ ] timeline 首屏就能看到当前任务骨架，而不是空白 waiting
- [ ] 每个 agent 卡片能显示：
  - `status`
  - `currentTask`
  - `latestResultSummary`
- [ ] 每个任务卡片能跳转到对应 session inspector
- [ ] 每个 artifact 都能直接打开或复制路径

##### 8. 性能与稳定性要求

- [ ] 前端只保留单一 snapshot polling / streaming，不再并行拉多份重复接口
- [ ] 尽量把 `sessions` / `metrics` / `timeline` 合并进 snapshot，减少重复对象构造
- [ ] 减少 dev 模式下大对象日志和无意义 interval
- [ ] snapshot route 要支持短 TTL / in-flight dedupe
- [ ] 后续可升级为 SSE snapshot diff 推送，减少轮询开销

##### 9. 验收标准

满足以下条件时，才算 dashboard 重构完成：

- [ ] sidekick / pm 一旦进入 running，dashboard 3 秒内出现对应 active 状态
- [ ] Timeline 不再出现“chat 有进展但 timeline 为空”的情况
- [ ] 任一 agent 最近结果可以在 dashboard 看到摘要
- [ ] developer 产出的 HTML / 本地文件可在 dashboard 点击打开
- [ ] 一个任务从 PM → Dev → Reviewer 的状态流转可在同一条 task/session 视图中连续看到
- [ ] 所有状态都来自 OpenClaw snapshot，而不是 UI 文案或前端拼凑事件

---

## Next（立即要做）

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
- [ ] 修复剩余 5 个 TypeScript 编译错误（sidekick-e2e.test.ts / type-safety-improvement.test.ts / fetch-mock-types.ts 等）
- [ ] 修复剩余 ESLint errors，清零
- [ ] 虚拟办公室冒烟测试：启动 dev server，验证页面加载、角色渲染、动画、音效、Dashboard 数据展示

### Batch 2.6: OpenClaw Snapshot Dashboard 收口

**目标**：把 dashboard 收口成真正的 OpenClaw 监控台，做到真实、准确、实时地反映 agent 活动与最终交付结果。

**可执行待办（cron 读取）**：
- [ ] 合并旧 `/api/openclaw/sessions` 与 `/api/openclaw/metrics` 消费方，统一迁移到 `/api/openclaw/snapshot`
- [ ] 从 OpenClaw history 派生真实 timeline 项，而不是占位 phase
- [ ] 为 snapshot 增加 `artifacts[]` 输出模型（path/url/title/type/producedBy）
- [ ] Dashboard 增加 Result / Artifact Panel
- [ ] 支持 HTML / 本地文件一键打开或复制路径
- [ ] Session Inspector 展示最新输出、最近消息、原始 session 状态
- [ ] Snapshot 改为单一前端数据源，移除 timeline 对 `game-events` 的依赖

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
- [ ] #008 GameEventStore 进程级单例 → Redis Pub/Sub 替代
- [ ] #009 DashboardStore DEFAULT_AGENTS 与实际 agent id 不匹配
- [ ] #152 每个任务独立的 agent 状态隔离

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
- [ ] #018 .DS_Store 提交进根目录 → git rm + .gitignore
- [ ] #194 根目录 node_modules 被提交 → git rm + .gitignore
- [ ] #195 根目录不是有效 Monorepo → 整理结构
- [ ] #012 emotionBubble 不跟随角色移动 → 重构为子节点
- [ ] #013 updateNavigation 只做 X 轴移动 → 加 Y 轴

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
- [ ] #229 Dev Agent 缺少项目技术栈信息 → ProjectContextBuilder
- [ ] #231 Agent 缺少任务历史上下文

---

## Later（后续演进）

### Batch 6: 安全加固

| Issue | 描述 | 优先级 |
|-------|------|--------|
| #143 | Sandbox DANGEROUS_PATTERNS 仅警告不阻断 → 改为 blocking | P1 |
| #144 | Sandbox 允许写入 .env 文件 → 移除 .env* 扩展名 | P1 |
| #145 | Sandbox 允许写入 .sh/.bash → 移除可执行扩展名 | P1 |
| #146 | 敏感文件写入防护扩展 | P2 |

### Batch 7: 部署与运维

- [ ] 部署到 Vercel 或类似平台
- [ ] 生产环境监控告警
- [ ] 日志聚合与分析

### Batch 8: UI/UX 打磨

- [ ] 角色头像升级（像素风 → 更高分辨率）
- [ ] 暗色主题支持
- [ ] 加载动画/骨架屏
- [ ] Dashboard 第 4 轮：汇总卡片、筛选、历史回看

---

## 给 Developer/Reviewer 的指令

**优先级**：Next > Soon > Later

当计划文件中没有 `[ ]` 任务时：
1. **停止工作** - 不要自己发明任务
2. **通知老苗** - "所有计划任务已完成，请规划下一阶段"
3. **不要启动 OpenCode**
