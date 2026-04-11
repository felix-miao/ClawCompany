# ClawCompany 开发计划

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

## P0 - Critical Fixes (必须修复)

**来源**: 第三轮源码审计确认（2026-04-10）

### 已修复（本轮）

- [x] ~~#001 三版 IMPLEMENTATION_PLAN 并存~~ → commit 77352ff 已删除
- [x] ~~#002 `/api/openclaw` 同步阻塞轮询~~ → 已改为立即返回 sessionKey
- [x] ~~#005 SceneEventBridge 未激活~~ → OfficeScene.ts 已调用 setupEventBridge()
- [x] ~~#177 Phaser 未做动态导入~~ → page.tsx useEffect 内动态 import

### 待修复

- [x] ~~#003 [P0][GAME] AgentCharacter 角色是纯色方块，无帧动画~~ → commit 603b79b 已实现程序化像素小人 + idle/walk/work 帧动画

- [code-complete] **#006 [P0][HYGIENE] MEMORY.md.backup 包含个人信息提交进公开仓库** → commits 616db1e, 499aaa3
  - **已完成**: .gitignore 添加 *.backup，删除 metrics-aggregator.ts.backup
  - **需人工**: 仍需执行 git history rewrite + force-push（origin: git@github.com:felix-miao/ClawCompany.git；本地当前未安装 git-filter-repo）

- [code-complete] **#067 [P0][API] game-events GET 端点完全无认证保护** → commit 7eb6e0b
  - **文件**: `src/app/api/game-events/route.ts` (第8行)
  - **问题**: GET 无 withAuth 包裹，POST 有认证但 GET 没有
  - **修复**: GET 加 withAuth 包裹

- [code-complete] **#068 [P0][LIB] 全局单例在 Serverless 环境下状态污染**
  - **文件**: GameEventStore.ts, session-poller.ts, executor.ts, client.ts, services.ts
  - **问题**: 5处模块级全局单例，并发请求共享状态
  - **修复**: 默认路径改为 factory / DI 优先的按请求创建；仅保留测试/兼容层需要的显式 singleton helper

- [code-complete] **#069 [P0][LIB] ChatManager 无消息数量上限，内存无界增长**
  - **文件**: `src/lib/chat/manager.ts` (31行)
  - **修复**: 加 maxMessages 参数（默认500），超出滚动删除

- [code-complete] **#070 [P0][LIB] api/client.ts fetch 无超时控制**
  - **文件**: `src/lib/api/client.ts` (50行/68行)
  - **修复**: AbortController + setTimeout 包裹 fetch

- [code-complete] **#141 [P0][SEC] Prompt Injection via Unfiltered User Message**
  - **文件**: `src/app/api/agent/route.ts` (26行/71行)
  - **问题**: userMessage 直接传给 LLM，无 sanitize 调用
  - **修复**: 导入 `sanitizeUserInput`，在调用 LLM provider 前对 userMessage 进行 sanitization

- [code-complete] **#142 [P0][SEC] AI 生成代码自动写入磁盘无人工审核**
  - **文件**: `src/lib/security/sandbox.ts` (169-176行)
  - **问题**: validateContent 检测到危险模式仅警告不阻断，allowed 永为 true
  - **修复**: 危险内容检测时必须阻断写入

- [code-complete] **#159 [P0][TEST] 函数覆盖率不足，核心逻辑测试盲区多**
  - **修复**: 设置覆盖率阈值 Functions ≥ 80%，补充未覆盖函数测试

- [code-complete] **#160 [P0][TEST] 无 CI 流水线，测试从不自动运行**
  - **修复**: 添加 GitHub Actions workflow（lint → build → test）
  - **文件**: `.github/workflows/ci.yml`

- [code-complete] **#176 [P0][PERF] SSE 连接数无限制，服务器资源耗尽风险** → commit b8b82e5
  - **文件**: `src/app/api/game-events/route.ts`
  - **修复**: 添加 MAX_SSE_CONNECTIONS=100，超出返回 503

- [code-complete] **#178 [P0][PERF] DashboardStore.events 用 Array.shift() O(n)，高频性能崩溃** → commit 611af89
  - **文件**: `src/game/data/DashboardStore.ts` (71行)
  - **修复**: 仿照 GameEventStore 改用环形缓冲区

- [code-complete] **#213 [P0][OPS] 完全缺失 CI/CD Pipeline**（与 #160 同一问题，已合并去重）
  - **修复**: `.github/workflows/ci.yml` 已由 #160 落地，无需重复实现

- [code-complete] **#214 [P0][OPS] 缺少 Dockerfile 和容器化方案** → commit f57ce7f
  - **修复**: 收口多阶段 Dockerfile + docker-compose.yml，移除 `.env` 硬依赖并补齐容器环境默认值；同时修复构建链路中的 `output/` 类型检查污染与 API Response 类型问题，`npm run build` / `docker compose config` 已通过

- [code-complete] **#215 [P0][OPS] 本地绝对路径硬编码在 .env.example**（已核实完成）
  - **修复**: `PROJECT_ROOT` 保持为 `./generated` 相对路径，并在容器环境映射到 `/data/generated`

---

## P0 - Dashboard 实时任务追踪（产品可见）

- [code-complete] **#P0-DASH-TRADITIONAL Dashboard 增加传统任务追踪视图（与游戏引擎可视化并存）**
  - **目标**: 除了 Phaser 办公室动画外，再提供一个传统 dashboard 视图，能实时看清“某一个任务当前走到哪一步了”
  - **展示原则**:
    1. **一眼看懂单个任务状态**：当前在哪个 agent（sidekick / pm / developer / tester / reviewer）
    2. **实时更新**：跟随 SSE / game-events / session 状态变化自动刷新
    3. **既能看当前，也能回看历史**：任务完成后仍可查看完整流转记录
    4. **游戏视图是氛围感，传统视图是信息密度**：两者并存，不互相替代
  - **建议设计**:
    - 左侧：任务列表（标题、优先级、当前状态、当前负责人、最后更新时间）
    - 中间：单任务步骤条 / 时间线
      - `submitted -> pm_analysis -> planning -> developer -> tester -> reviewer -> done/failed`
    - 右侧：详情面板
      - 当前 agent
      - 当前阶段说明
      - 最近事件日志
      - 相关 session / 产出物 / 错误信息
    - 顶部：汇总卡片（进行中 / 等待中 / 已完成 / 失败）
  - **最少交付**:
    1. Dashboard 中新增“传统任务视图 / Timeline View”入口
    2. 能选中某个任务并看到完整步骤条
    3. 每一步显示开始时间、完成时间、负责人、状态
    4. 如果卡住，明确显示卡在哪个 agent / 哪个阶段
    5. 与现有 game-events / DashboardStore / sessions 数据打通，避免造第二套假数据
  - **建议迭代顺序（TDD）**:
    - 第 1 轮：先补任务阶段数据模型 / mock / store 映射测试，再做最小可用 timeline
    - 第 2 轮：补单任务详情面板（当前阶段、负责人、最近事件）
    - 第 3 轮：补实时更新 / 失败态 / 卡点展示
    - 第 4 轮：补汇总卡片、筛选、可回看历史
    - 每一轮都要问自己：还有没有更清楚、更少噪音、更能定位卡点的展示方式
  - **文件建议**:
    - `src/app/dashboard/*`
    - `src/components/dashboard/*`
    - `src/game/data/DashboardStore.ts`
    - `src/app/api/game-events/route.ts`（如需补事件字段）
  - **当前进展**:
    - 2026-04-11（Developer 第 1 轮增量）✅ 已完成最小 timeline 入口与基础任务追踪：Dashboard 新增 `Timeline View` 切换；`DashboardStore` 可从现有 task/game events 派生任务阶段历史；传统视图可选任务并显示步骤条、开始/结束时间、负责人、当前卡点；`useDashboardStore` 同步修复为基于 store version 刷新，避免 `loadAgents` 这类非 event 更新不触发 UI 刷新。
    - 2026-04-12（Developer 第 2 轮增量）✅ 已完成详情面板增强：`DashboardStore` 现在保留每个任务的 recent events 与 failure summary；`TraditionalTaskView` 新增当前阶段说明、最近事件日志、错误摘要、最后更新时间与 live 状态，并把 handover / waiting 文案映射成可读 agent 名称而不是裸 `agentId`；同时兼容旧 mock / 旧数据缺少 `recentEvents` 的情况，避免切到 Timeline View 时崩溃。commit: `f446508`。
    - 2026-04-12（Developer 第 3 轮增量）✅ 已完成实时更新 / 失败态 / 卡点展示：`DashboardStore` 补齐 `task:progress`、`dev:iteration-start`、`review:rejected`、`workflow:iteration-complete` 的派生追踪，并兼容事件字段既可能在 `payload` 内，也可能是扁平字段；`TraditionalTaskView` 现在会突出显示停滞 / 活跃 / 等待他人 / 失败 / 返工 / 已通过等状态，展示等待时长、最近进展、最新 review 反馈，并把失败 / 打回 / 停滞任务排到更前面，减少用户靠事件列表自己推断卡点的成本。
    - 后续可选增强：继续做第 4 轮“汇总卡片 / 筛选 / 历史回看”，把 attention-first 的任务列表扩展成更强的全局概览。
  - **验收标准**:
    - 提交一个真实任务后，用户能在非游戏界面里实时看到任务推进到哪一步
    - 任务失败时，能在传统视图中直接看到失败阶段和错误摘要
    - 任务完成后，能回看完整时间线

## P1 - 应该修复（High）

- [ ] **#007 `/api/chat` 与 `/api/agent` 职责重叠** → 明确分工
- [ ] **#008 GameEventStore 进程级单例** → Redis Pub/Sub 替代
- [ ] **#009 DashboardStore DEFAULT_AGENTS 与实际 agent id 不匹配** → 统一命名
- [ ] **#012 emotionBubble 不跟随角色移动** → 重构为子节点
- [ ] **#013 updateNavigation 只做 X 轴移动** → 加 Y 轴
- [ ] **#018 .DS_Store 提交进根目录** → git rm + .gitignore
- [ ] **#067 → 合并到上方 P0 已列**
- [ ] **#143 Sandbox DANGEROUS_PATTERNS 仅警告不阻断** → 改为 blocking
- [ ] **#144 Sandbox 允许写入 .env 文件** → 移除 .env* 扩展名
- [ ] **#145 Sandbox 允许写入 .sh/.bash** → 移除可执行扩展名
- [ ] **#194 根目录 node_modules 被提交** → git rm + .gitignore
- [ ] **#195 根目录不是有效 Monorepo** → 整理结构
- [ ] **#228 System Prompt 缺少上下文注入** → 动态注入项目状态
- [ ] **#229 Dev Agent 缺少项目技术栈信息** → ProjectContextBuilder
- [ ] **#230 PM Agent 依赖使用标题字符串** → 改用索引/slug
- [ ] **#232 Review Agent 结果不影响工作流** → 读取 approved 字段
- [ ] **#233 缺少全局 maxTokens 限制** → AgentConfig 加 maxTokens

---

## P2/P3 - 建议修复（后续迭代）

- [ ] CI/CD：GitHub Actions 配置 lint → tsc → test → build 流水线
- [ ] 部署到 Vercel 或类似平台
- [ ] UI 打磨：角色头像升级、暗色主题、加载动画/骨架屏

---

## 给 Developer/Reviewer 的指令

**优先级**：P0 待修复 > P1 > P2

当计划文件中没有 `[ ]` 任务时：
1. **停止工作** - 不要自己发明任务
2. **通知老苗** - "所有计划任务已完成，请规划下一阶段"
3. **不要启动 OpenCode"
