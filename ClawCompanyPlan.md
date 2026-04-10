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

- [ ] **#003 [P0][GAME] AgentCharacter 角色是纯色方块，无帧动画**
  - **文件**: `src/game/characters/AgentCharacter.ts` (369-384行)
  - **问题**: createAgent() 仍用 graphics.fillRoundedRect 生成纯色方块，无 spritesheet，无 scene.anims.create()
  - **修复**: 程序化绘制像素小人 + idle/walk/work 三套基础帧动画

- [ ] **#006 [P0][HYGIENE] MEMORY.md.backup 包含个人信息提交进公开仓库**
  - **文件**: `MEMORY.md.backup.20260320_094004` (已删但 git 历史仍在)
  - **修复**: git filter-repo 清理历史 + .gitignore 添加 *.backup

- [ ] **#067 [P0][API] game-events GET 端点完全无认证保护**
  - **文件**: `src/app/api/game-events/route.ts` (第8行)
  - **问题**: GET 无 withAuth 包裹，POST 有认证但 GET 没有
  - **修复**: GET 加 withAuth 包裹

- [ ] **#068 [P0][LIB] 全局单例在 Serverless 环境下状态污染**
  - **文件**: GameEventStore.ts, session-poller.ts, executor.ts, client.ts, services.ts
  - **问题**: 5处模块级全局单例，并发请求共享状态
  - **修复**: 删除全局单例导出，通过 DI Container 按请求创建实例

- [ ] **#069 [P0][LIB] ChatManager 无消息数量上限，内存无界增长**
  - **文件**: `src/lib/chat/manager.ts` (31行)
  - **修复**: 加 maxMessages 参数（默认500），超出滚动删除

- [ ] **#070 [P0][LIB] api/client.ts fetch 无超时控制**
  - **文件**: `src/lib/api/client.ts` (50行/68行)
  - **修复**: AbortController + setTimeout 包裹 fetch

- [ ] **#141 [P0][SEC] Prompt Injection via Unfiltered User Message**
  - **文件**: `src/app/api/agent/route.ts` (26行/71行)
  - **问题**: userMessage 直接传给 LLM，无 sanitize 调用
  - **修复**: 添加 prompt injection 检测层

- [ ] **#142 [P0][SEC] AI 生成代码自动写入磁盘无人工审核**
  - **文件**: `src/lib/security/sandbox.ts` (169-176行)
  - **问题**: validateContent 检测到危险模式仅警告不阻断，allowed 永为 true
  - **修复**: 危险内容检测时必须阻断写入

- [ ] **#159 [P0][TEST] 函数覆盖率不足，核心逻辑测试盲区多**
  - **修复**: 设置覆盖率阈值 Functions ≥ 80%，补充未覆盖函数测试

- [ ] **#160 [P0][TEST] 无 CI 流水线，测试从不自动运行**
  - **修复**: 添加 GitHub Actions workflow（lint → build → test）

- [ ] **#176 [P0][PERF] SSE 连接数无限制，服务器资源耗尽风险**
  - **文件**: `src/app/api/game-events/route.ts`
  - **修复**: 添加 MAX_SSE_CONNECTIONS=100，超出返回 503

- [ ] **#178 [P0][PERF] DashboardStore.events 用 Array.shift() O(n)，高频性能崩溃**
  - **文件**: `src/game/data/DashboardStore.ts` (71行)
  - **修复**: 仿照 GameEventStore 改用环形缓冲区

- [ ] **#213 [P0][OPS] 完全缺失 CI/CD Pipeline**（与 #160 同一问题）
  - **修复**: 创建 .github/workflows/ci.yml

- [ ] **#214 [P0][OPS] 缺少 Dockerfile 和容器化方案**
  - **修复**: 创建多阶段 Dockerfile + docker-compose.yml

- [ ] **#215 [P0][OPS] 本地绝对路径硬编码在 .env.example**（已确认仍存在）
  - **修复**: PROJECT_ROOT 改为 ./generated

---

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
