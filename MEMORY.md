# MEMORY.md - 长期记忆

创建时间: 2026-03-14
最后更新: 2026-03-30

## 最近优化 (2026-03-30)

### 已完成
- ✅ **数据共享软链接** - 所有 agent 的 `data/` 都指向 `~/.openclaw/shared-data/`
- ✅ **Telegram Token 迁移** - 已创建 credentials 文件
- ✅ **Dashboard 开发完成** - SSE 实时监控
- ✅ **SOUL.md 更新** - 添加了数据访问规则

### 关于任务监控机制

**结论：不实施新的轮询机制**

**原因：**
1. `sessions_list` 可以直接查看 agent 状态
2. `sessions_history` 可以获取执行历史
3. 文件轮询 + session 监控已足够

---

## ClawCompany Multi-Agent 系统

### 架构
- **sidekick** - 消息路由器（Telegram 绑定）
- **pm** - 项目经理
- **developer** - 开发工程师
- **tester** - 测试工程师
- **reviewer** - 审核官

### 工作流
```
用户 (Telegram)
  ↓
sidekick (消息路由器)
  ↓ 调用 pm
  ↓
pm 分析需求，写入 plan.md
  ↓ 调用 developer
  ↓
developer 实现，执行测试
  ↓ 调用 tester
  ↓
tester 测试
  ↓ 调用 pm
  ↓
pm 调用 reviewer
  ↓
reviewer 审核
  ↓ 返回 sidekick
  ↓
sidekick 回复用户
```

### 数据共享
- 位置： `~/.openclaw/shared-data/`
- 文件： `data/tasks.json` - 任务状态
- 规则： **只追加更新**，不覆盖

### 下一步
1. 开发 Dev Agent 真实执行能力
2. Dashboard 接入真实 OpenClaw 数据
3. 完整端到端测试
