# OpenClaw Skill 开发模式分析

**研究时间：** 2026-03-20 18:50
**研究样本：** weather, github, coding-agent, canvas, mcporter

---

## 📊 Skill 结构分析

### 1. Metadata 配置模式

#### 简单模式（weather）
```yaml
metadata:
  openclaw:
    emoji: ☔
    requires:
      bins: [curl]
```

**特点：**
- 最小化配置
- 只需要命令行工具
- 不需要安装步骤

---

#### 中等模式（github）
```yaml
metadata:
  openclaw:
    emoji: 🐙
    requires:
      bins: [gh]
    install:
      - id: brew
        kind: brew
        formula: gh
        bins: [gh]
        label: Install GitHub CLI (brew)
      - id: apt
        kind: apt
        package: gh
        bins: [gh]
        label: Install GitHub CLI (apt)
```

**特点：**
- 多平台安装支持
- 提供 brew/apt 选项
- 用户可以选择

---

#### 复杂模式（coding-agent）
```yaml
metadata:
  openclaw:
    emoji: 🧩
    requires:
      anyBins: [claude, codex, opencode, pi]
```

**特点：**
- `anyBins` - 满足任一即可
- 更灵活的依赖
- 支持多个 coding agents

---

### 2. Skill 文档结构

#### 标准结构

```markdown
---
name: skill-name
description: 描述
metadata: { ... }
---

# Skill Name

## When to Use
✅ USE this skill when: ...
❌ DON'T use this skill when: ...

## Setup/Installation
[安装步骤]

## Common Commands
[常用命令]

## Examples
[使用示例]

## Notes
[注意事项]
```

---

### 3. 命令执行模式

#### 模式 A：直接执行（weather）
```bash
curl "wttr.in/London?format=3"
```

**特点：**
- 简单的 bash 命令
- 不需要交互
- 快速响应

---

#### 模式 B：CLI 工具（github）
```bash
gh pr list --repo owner/repo
gh issue create --title "Bug" --body "Details"
```

**特点：**
- 需要认证
- 更复杂的功能
- 可能需要交互

---

#### 模式 C：PTY 模式（coding-agent）
```bash
bash pty:true command:"codex exec 'Your prompt'"
bash pty:true background:true command:"opencode run 'Task'"
```

**特点：**
- 需要伪终端
- 交互式应用
- 长时间运行

---

### 4. MCP 集成模式（mcporter）

#### 基本用法
```bash
# 安装
npm install -g mcporter @modelcontextprotocol/server-figma

# 认证
mcporter auth figma

# 调用
mcporter call figma.get_file file_key=XXX
```

**关键点：**
1. 需要先安装 mcporter
2. 需要认证每个 MCP server
3. 使用 `mcporter call` 调用功能

---

## 🎯 最佳实践总结

### 1. Metadata 配置

**必须字段：**
- `name` - skill 标识符
- `description` - 简短描述
- `emoji` - 视觉标识
- `requires` - 依赖要求

**可选字段：**
- `install` - 安装步骤
- `primaryEnv` - 主要环境变量
- `mcpServers` - MCP 服务器列表

---

### 2. 文档编写

**必须包含：**
- ✅ When to Use / When NOT to Use
- ✅ Setup/Installation
- ✅ Common Commands
- ✅ Examples

**推荐包含：**
- ⭐ Notes 和注意事项
- ⭐ Troubleshooting
- ⭐ Advanced Usage

---

### 3. 工具集成

**简单工具：**
- 直接在 SKILL.md 中提供命令
- 不需要 install 配置

**复杂工具：**
- 提供 install 配置
- 支持多平台
- 提供认证步骤

**PTY 工具：**
- 在文档中说明需要 PTY
- 提供 `pty:true` 示例
- 提供 `background:true` 示例

---

### 4. MCP 集成

**标准流程：**
1. 在 metadata 中声明 `mcpServers`
2. 在 install 中添加 mcporter 和 MCP server
3. 在文档中说明认证步骤
4. 提供调用示例

---

## 📋 发现的问题

### 问题 1：我的 skills 缺少实际测试
- ❌ 没有验证 metadata 是否正确
- ❌ 没有测试安装流程
- ❌ 没有验证命令是否工作

### 问题 2：缺少 When NOT to Use
- ⚠️ 只有部分 skills 有这个部分
- ⚠️ 需要更清晰的边界

### 问题 3：缺少 Troubleshooting
- ⚠️ 没有常见问题解答
- ⚠️ 没有错误处理指南

---

## ✅ 改进计划

### 立即改进：
1. 为所有 skills 添加 When NOT to Use
2. 添加 Troubleshooting 部分
3. 实际测试每个 skill 的命令
4. 验证 metadata 配置

### 下一步：
1. 测试 MCP 集成是否可行
2. 验证自动安装流程
3. 创建真实的使用示例
4. 编写完整的测试用例

---

**Phase 1.1 完成！开始 Phase 1.2：研究 MCP 集成机制** 🚀

---

*研究时间: 2026-03-20 18:50*
*Token 使用: ~8k*
