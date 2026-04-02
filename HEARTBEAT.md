# HEARTBEAT.md - ClawCompany 自动优化

## Cron 任务配置

### 每 30 分钟迭代任务
- **任务名**: clawcompany-iterate
- **频率**: 每 30 分钟
- **工作目录**: `/Users/felixmiao/Projects/ClawCompany`
- **详细 Prompt**: `~/.openclaw/workspace/memory/clawcompany-iterate-prompt.md`
- **执行内容**:
  1. **启动 OpenCode**（使用 `exec` + `pty:true` + `background:true`）
  2. **监督执行**（通过 `process` 工具监控进度，确保 OpenCode 没有偷懒）
  3. **检查结果**（验证任务是否真的完成，代码是否提交，进度是否更新）

**我的角色**:
- ✅ 启动任务（不是 OpenCode 自己启动）
- ✅ 监督执行（定期检查进度，防止 OpenCode 卡住或偷懒）
- ✅ 检查结果（确认任务完成、代码提交、进度文件更新）
- ❌ 不做决策（所有决策由 OpenCode 来做）

### 每天早上 8 点研究任务
- **任务名**: daily-multiagent-research
- **频率**: 每天 08:00 (Asia/Shanghai)
- **执行内容**:
  1. 搜索前沿多 agent 项目
  2. 分析特点和创新点
  3. 与 ClawCompany 对比
  4. 提供启发建议

## 项目结构

```
/Users/felixmiao/Projects/ClawCompany/
├── ai-team-demo/      # Next.js 应用
├── skill/             # OpenClaw Skill
├── docs/              # 文档
├── scripts/           # 工具脚本
├── memory/            # 开发日志
└── README.md          # 项目说明
```

---
*最后更新: 2026-03-30 21:46*
