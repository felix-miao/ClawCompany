# HEARTBEAT.md - ClawCompany 自动优化

## 每2小时检查任务

### 检查项
1. [ ] ClawCompany 是否有新 commit（最近2小时）
2. [ ] OpenCode 是否正在运行（检查进程）
3. [ ] 是否有待处理的任务

### 如果都为否，执行以下操作之一：
- [ ] 让 OpenCode 建议下一个优化点
- [ ] 完善测试用例
- [ ] 代码质量改进
- [ ] 文档更新

### 工作流程
1. 检查 `git log --since="2 hours ago"` 
2. 检查 `pgrep -f opencode`
3. 如果都无，调用 OpenCode 获取建议
4. 我来做决策并审查结果
5. 提交并通过

### Cron 设置
```bash
openclaw cron add --id clawcompany-check --schedule "0 */2 * * *" --message "检查 ClawCompany 状态，如果没有新 commit 且 OpenCode 不活跃，建议优化点"
```

### 记录
| 时间 | 操作 | 结果 |
|------|------|------|
| 2026-03-30 16:52 | 设置自动优化 | ✅ HEARTBEAT.md 创建 |

---
*此文件由 main agent 维护，每2小时检查一次*
