# ClawCompany 架构改进计划 - 基于三省六部架构

**创建时间：** 2026-03-21 21:48
**目标：** 将 ClawCompany 从原型升级为生产级产品
**参考：** Edict 三省六部架构
**预计 Token：** 150k

---

## 🎯 核心改进方向

### 1. 架构层面

**当前问题：**
- ❌ 没有审核机制
- ❌ 权限控制不严格
- ❌ 缺少状态机管理
- ❌ 缺少可观测性

**改进目标：**
- ✅ 引入审核角色（类似门下省）
- ✅ 建立权限矩阵
- ✅ 实现状态机管理
- ✅ 添加实时看板

---

## 📋 Phase 1：状态机设计（20k tokens）

### 1.1 任务状态定义

```typescript
enum TaskState {
  PENDING = 'Pending',       // 待处理
  PLANNING = 'Planning',     // 规划中（PM Agent）
  REVIEW = 'Review',         // 审核中（Reviewer Agent）
  ASSIGNED = 'Assigned',     // 已派发
  DOING = 'Doing',           // 执行中（Developer Agent）
  TESTING = 'Testing',       // 测试中（Tester Agent）
  DONE = 'Done',             // 已完成
  CANCELLED = 'Cancelled',   // 已取消
  BLOCKED = 'Blocked'        // 被阻塞
}
```

### 1.2 状态转移规则

```typescript
const STATE_TRANSITIONS = {
  'Pending':    ['Planning', 'Cancelled'],
  'Planning':   ['Review', 'Blocked'],
  'Review':     ['Planning', 'Assigned'],  // Reviewer 可以打回或批准
  'Assigned':   ['Doing', 'Testing'],
  'Doing':      ['Testing', 'Review', 'Blocked'],
  'Testing':    ['Doing', 'Done', 'Blocked'],
  'Done':       [],  // 终态
  'Cancelled':  [],  // 终态
  'Blocked':    ['Planning', 'Cancelled']
};
```

### 1.3 权限矩阵

```typescript
const PERMISSION_MATRIX = {
  'pm': {
    canCreate: true,
    canEdit: ['Planning'],
    canApprove: false,
    canDispatch: ['architect', 'developer', 'tester', 'devops']
  },
  'reviewer': {
    canCreate: false,
    canEdit: [],
    canApprove: true,  // 可以批准或打回
    canReject: true,   // 可以封驳
    canDispatch: []
  },
  'architect': {
    canCreate: false,
    canEdit: [],
    canApprove: false,
    canDispatch: ['developer', 'devops']
  },
  'developer': {
    canCreate: false,
    canEdit: ['Doing'],
    canApprove: false,
    canDispatch: ['tester']
  },
  'tester': {
    canCreate: false,
    canEdit: ['Testing'],
    canApprove: false,
    canDispatch: ['developer']
  }
};
```

---

## 📋 Phase 2：审核机制（30k tokens）

### 2.1 Reviewer Agent 设计

**职责：**
1. 📋 审查 PM 提出的方案
2. 🚫 封驳不合格方案
3. 🔄 要求 PM 修改
4. ✅ 批准方案并派发

**SOUL.md 示例：**

```markdown
# Reviewer Agent - 质量把关人

## 角色定位
你是 ClawCompany 的审核官，负责审查所有方案的质量。

## 核心职责
1. 审查 PM 提出的方案（可行性、完整性、风险）
2. 决定：批准 OR 封驳
3. 如果封驳，提供详细的修改建议

## 审核标准
- ✅ 需求理解是否准确
- ✅ 技术方案是否可行
- ✅ 任务拆解是否合理
- ✅ 风险是否识别
- ✅ 时间估算是否合理

## 封驳规则
- ❌ 需求理解偏差 > 30%
- ❌ 技术方案有明显缺陷
- ❌ 任务拆解遗漏关键步骤
- ❌ 未识别重大风险
- ❌ 时间估算不合理（偏差 > 50%）

## 返工机制
- 最多返工 3 次
- 每次返工必须提供详细建议
- 超过 3 次，自动升级到人工审核
```

### 2.2 审核流程

```typescript
async function reviewTask(task: Task): Promise<ReviewResult> {
  // 1. 调用 Reviewer Agent
  const review = await callAgent('reviewer', {
    task: task.description,
    plan: task.plan,
    todos: task.todos
  });

  // 2. 解析审核结果
  if (review.approved) {
    // 批准 → 派发给执行团队
    return {
      status: 'approved',
      feedback: review.feedback,
      nextState: 'Assigned'
    };
  } else {
    // 封驳 → 返回 PM 修改
    return {
      status: 'rejected',
      feedback: review.suggestions,
      nextState: 'Planning',
      retryCount: task.retryCount + 1
    };
  }
}
```

---

## 📋 Phase 3：实时看板（50k tokens）

### 3.1 看板架构

```
前端（React）
  ├─ Dashboard 组件
  │   ├─ KanbanView（看板视图）
  │   ├─ ListView（列表视图）
  │   └─ TimelineView（时间线视图）
  ├─ TaskDetail 组件
  │   ├─ 基本信息
  │   ├─ 流转记录
  │   ├─ 进度汇报
  │   └─ Agent 活动
  └─ RealtimeUpdates（WebSocket）

后端（Next.js API）
  ├─ /api/tasks（任务 CRUD）
  ├─ /api/tasks/[id]/state（状态转移）
  ├─ /api/tasks/[id]/review（审核）
  └─ /api/ws（WebSocket）

数据存储
  ├─ tasks.json（任务数据）
  ├─ sessions/*.jsonl（Agent 会话）
  └─ flow_log.json（流转记录）
```

### 3.2 看板功能

**1. 任务看板**
- 按状态列展示任务
- 拖拽改变状态
- 过滤和搜索
- 心跳徽章（🟢活跃 🟡停滞 🔴告警）

**2. 任务详情**
- 五阶段时间线
- 流转记录
- 进度汇报
- Agent 活动（thinking + tool_result）

**3. Agent 总览**
- Token 消耗排行
- 活跃度统计
- 任务完成数

**4. 实时更新**
- WebSocket 推送
- 状态变化通知
- Agent 活动通知

---

## 📋 Phase 4：调度系统（30k tokens）

### 4.1 自动派发

```typescript
async function dispatchTask(task: Task, nextState: TaskState) {
  // 1. 查表获取目标 Agent
  const agentId = STATE_AGENT_MAP[nextState];

  // 2. 构造派发消息
  const message = buildDispatchMessage(task, nextState);

  // 3. 异步派发
  await spawnAgent(agentId, message);

  // 4. 记录派发状态
  task._scheduler = {
    lastDispatchStatus: 'success',
    lastDispatchAgent: agentId,
    lastDispatchAt: new Date()
  };
}
```

### 4.2 超时重试

```typescript
async function handleStalledTask(task: Task) {
  const elapsed = Date.now() - task.lastProgressAt;

  if (elapsed < 180000) return; // 3 分钟内不处理

  if (task.retryCount < 1) {
    // 重试
    task.retryCount++;
    await dispatchTask(task, task.state);
    log(`任务停滞，自动重试第 ${task.retryCount} 次`);
  } else if (task.escalationLevel < 2) {
    // 升级
    task.escalationLevel++;
    const agent = task.escalationLevel === 1 ? 'reviewer' : 'pm';
    await wakeAgent(agent, `任务 ${task.id} 停滞，请介入`);
    log(`升级至 ${agent} 协调`);
  } else {
    // 自动回滚
    task.state = task.snapshot.state;
    task.retryCount = 0;
    task.escalationLevel = 0;
    await dispatchTask(task, task.state);
    log(`连续停滞，自动回滚到 ${task.snapshot.state}`);
  }
}
```

---

## 📋 Phase 5：数据融合（20k tokens）

### 5.1 三层数据源

```
1️⃣ flow_log - 状态转移记录
   └─ Planning → Review → Assigned
   └─ 来自：state transition API

2️⃣ progress_log - 实时工作汇报
   └─ "正在分析需求..."
   └─ 来自：Agent 主动汇报
   └─ 周期：每 30 分钟

3️⃣ session JSONL - Agent 思考过程
   └─ thinking（思维链）
   └─ tool_result（工具调用）
   └─ 来自：OpenClaw 自动记录
```

### 5.2 融合逻辑

```typescript
function getTaskActivity(taskId: string) {
  const task = loadTask(taskId);

  // 1. 加载 flow_log
  const flowLog = task.flow_log || [];

  // 2. 加载 progress_log
  const progressLog = task.progress_log || [];

  // 3. 加载 session JSONL
  const sessionLog = loadSessionLog(task.assignedAgent);

  // 4. 融合并排序
  const activity = [...flowLog, ...progressLog, ...sessionLog]
    .sort((a, b) => a.at.localeCompare(b.at));

  return {
    activity,
    activitySource: 'flow+progress+session'
  };
}
```

---

## 🎯 实施计划

### Week 1：基础架构（40k tokens）
- [ ] 实现状态机
- [ ] 添加权限矩阵
- [ ] 实现 flow_log 记录
- [ ] 创建 Reviewer Agent

### Week 2：审核机制（30k tokens）
- [ ] 实现审核流程
- [ ] 添加封驳逻辑
- [ ] 实现返工机制
- [ ] 测试审核流程

### Week 3：实时看板（50k tokens）
- [ ] 创建 React 前端
- [ ] 实现 WebSocket 通信
- [ ] 添加看板视图
- [ ] 实现任务详情

### Week 4：调度系统（30k tokens）
- [ ] 实现自动派发
- [ ] 添加超时重试
- [ ] 实现停滞升级
- [ ] 添加自动回滚

---

## 📊 预期效果

### 对比改进

| 特点 | 当前 ClawCompany | 改进后 |
|------|-----------------|--------|
| **审核机制** | ❌ 无 | ✅ Reviewer Agent |
| **状态管理** | ⚠️ 简单 | ✅ 9 状态状态机 |
| **权限控制** | ❌ 无 | ✅ 严格权限矩阵 |
| **可观测性** | ⚠️ 日志 | ✅ 实时看板 |
| **任务干预** | ❌ 无 | ✅ stop/cancel/resume |
| **审计追踪** | ⚠️ 简单 | ✅ 完整活动流 |

---

## 🚀 下一步行动

**立即开始（下次心跳）：**

1. ✅ **创建 Reviewer Agent**（10k tokens）
   - 编写 SOUL.md
   - 定义审核标准
   - 实现审核逻辑

2. ✅ **实现状态机**（15k tokens）
   - 定义状态和转移
   - 实现权限检查
   - 添加 flow_log

3. ✅ **创建看板原型**（20k tokens）
   - React 前端基础
   - 任务列表视图
   - 状态列视图

---

**准备开始实施！** 🎯

---

*创建时间: 2026-03-21 21:48*
*预计完成: 4 周*
*Token 预算: 150k*
