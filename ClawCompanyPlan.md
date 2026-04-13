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
