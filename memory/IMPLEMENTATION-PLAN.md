# ClawCompany 真实代码实现计划

## 🚨 问题诊断

**当前状态：**
- ❌ 代码是伪代码（模拟实现）
- ❌ 没有真正调用 OpenClaw sessions_spawn
- ❌ PM/Dev/Review Agent 都是假的
- ❌ Commit 都是文档，没有实际功能

---

## ✅ 真实实现目标

**要做什么：**
1. 真正调用 `sessions_spawn` API
2. 真正调用 `sessions_history` API
3. 真正调用 `sessions_send` API
4. 处理真实的 GLM-5 响应
5. 处理真实的 OpenCode 响应

---

## 📋 具体实现步骤

### Step 1: 研究 OpenClaw API（30分钟）

**要搞清楚：**
```bash
# 查看OpenClaw的API文档
openclaw --help
openclaw sessions --help
openclaw spawn --help
```

**要回答：**
- sessions_spawn 的正确调用方式
- sessions_history 的正确参数
- 如何等待 session 完成
- 如何获取 agent 的输出

---

### Step 2: 实现真实的 PM Agent（1小时）

**要实现：**
```typescript
// 真实实现
async function runPMAgent(userRequest: string): Promise<Task[]> {
  // 1. 调用 sessions_spawn
  const session = await sessions_spawn({
    runtime: 'subagent',
    task: `你是PM Agent。分析需求：${userRequest}`,
    thinking: 'high',
    mode: 'run'
  })

  // 2. 等待完成（轮询或等待）
  while (true) {
    const history = await sessions_history({ sessionKey: session.sessionKey })
    if (history.status === 'completed') {
      break
    }
    await sleep(1000)
  }

  // 3. 获取结果
  const history = await sessions_history({ sessionKey: session.sessionKey })
  const lastMessage = history.messages[history.messages.length - 1]
  return JSON.parse(lastMessage.content).tasks
}
```

---

### Step 3: 实现真实的 Dev Agent（1小时）

**要实现：**
```typescript
async function runDevAgent(task: Task, projectPath: string): Promise<string[]> {
  // 1. 调用 sessions_spawn (OpenCode)
  const session = await sessions_spawn({
    runtime: 'acp',
    agentId: 'opencode',
    task: `实现任务：${task.description}`,
    cwd: projectPath,
    mode: 'run'
  })

  // 2. 等待完成
  // 3. 获取生成的文件列表
  // 4. 返回文件路径
}
```

---

### Step 4: 实现真实的 Review Agent（1小时）

**要实现：**
```typescript
async function runReviewAgent(task: Task, files: string[]): Promise<boolean> {
  // 1. 调用 sessions_spawn
  const session = await sessions_spawn({
    runtime: 'subagent',
    task: `审查代码：${files.join(', ')}`,
    thinking: 'high',
    mode: 'run'
  })

  // 2. 等待完成
  // 3. 解析审查结果
  // 4. 返回是否批准
}
```

---

### Step 5: 测试真实集成（1小时）

**要测试：**
- 测试 PM Agent 真实调用
- 测试 Dev Agent (OpenCode) 真实调用
- 测试 Review Agent 真实调用
- 端到端测试

---

## ⏰ 时间规划

**到晚上8点（还有2小时40分钟）：**

| 时间 | 任务 | 产出 |
|------|------|------|
| 17:20-17:50 | 研究OpenClaw API | API调用方式明确 |
| 17:50-18:50 | 实现PM/Dev/Review Agent | 真实代码 |
| 18:50-19:30 | 测试和调试 | 可工作的版本 |
| 19:30-19:50 | 最终优化 | 准备录demo |
| 20:00 | 录制demo | Demo视频 |

---

## 🚫 不要做的事

- ❌ 不要提交纯文档的commit
- ❌ 不要写伪代码
- ❌ 不要模拟实现

---

## ✅ 要做的事

- ✅ 研究真实的 OpenClaw API
- ✅ 写真实的 sessions_spawn 调用
- ✅ 测试真实集成
- ✅ 只提交有功能的代码

---

## 📊 成功标准

**晚上8点前要达到：**
1. ✅ PM Agent 能真实调用 GLM-5
2. ✅ Dev Agent 能真实调用 OpenCode
3. ✅ Review Agent 能真实审查
4. ✅ Demo 录制一切就绪

---

*计划创建时间: 17:13*
*最后更新: 17:13*
