# ACP + opencode 配置指南

## 概述

ClawCompany 的 Dev agent 使用 ACP（Agent Control Protocol）通过 [opencode](https://opencode.ai) 真正把代码写入磁盘，而不只是返回文字描述。

## 架构

```
ClawCompany orchestrator
  → executor.ts (runtime: 'acp', agentId: 'opencode')
    → OpenClaw Gateway sessions.spawn
      → acpx 插件
        → opencode ACP stdio 服务
          → 真正写文件到磁盘 ✅
```

## 前置条件

| 依赖 | 路径 | 说明 |
|------|------|------|
| opencode | `/usr/lib/node_modules/opencode-ai/bin/.opencode` | ACP stdio 服务 |
| acpx | `/usr/lib/node_modules/openclaw/extensions/acpx/` | ACP 客户端插件 |
| GITHUB_TOKEN | 环境变量 | GitHub Copilot 模型认证 |

## openclaw.json 配置

在 `~/.openclaw/openclaw.json` 中需要添加以下配置（**不进 git**，属于系统配置）：

```json
{
  "acp": {
    "enabled": true,
    "defaultAgent": "opencode",
    "backend": "acpx"
  },
  "plugins": {
    "entries": {
      "acpx": {
        "enabled": true,
        "config": {
          "permissionMode": "approve-all",
          "nonInteractivePermissions": "fail",
          "agents": {
            "opencode": {
              "command": "/usr/lib/node_modules/opencode-ai/bin/.opencode acp"
            }
          }
        }
      }
    }
  }
}
```

> 此配置已在 2026-04-10 部署到开发机。新环境需手动添加。

## 环境变量

Dev agent 通过 ACP 调用 opencode 时，opencode 使用 GitHub Copilot 模型。需要：

```bash
export GITHUB_TOKEN=$(gh auth token)
```

或在 `.env.local` 中添加：

```
GITHUB_TOKEN=your-github-token-here
```

## 验证

```bash
export GITHUB_TOKEN=$(gh auth token)
cd /home/openclaw/.openclaw/workspace/ClawCompany

npx acpx --cwd . --approve-all --format quiet \
  opencode exec "Create a file test-acp.txt with content 'ACP works!'"

ls test-acp.txt && cat test-acp.txt && rm test-acp.txt
```

预期输出：`ACP works!`

## executor.ts 变更说明

`src/lib/gateway/executor.ts` 中 Dev agent 的 `executeAgent` 调用现在会传递：
- `agentId: 'opencode'` — 指向 opencode ACP 后端
- `cwd: PROJECT_CWD` — 项目工作目录，让 opencode 在正确路径写文件

`PROJECT_CWD` 默认解析为项目根目录，可通过 `CLAWCOMPANY_CWD` 环境变量覆盖。

## 权限模式说明

| 模式 | 说明 | 推荐场景 |
|------|------|---------|
| `approve-all` | 自动批准所有操作 | CI/开发环境 |
| `approve-reads` | 只自动批准读操作 | 谨慎场景 |
| `deny-all` | 拒绝所有操作 | 测试/调试 |
