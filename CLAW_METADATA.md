# Claw Skills Metadata 汇总

**更新时间：** 2026-03-20 16:12
**版本：** 1.0

---

## 📋 Metadata 字段说明

### 标准字段

```yaml
name: skill-name           # Skill 标识符
description: 描述          # 简短描述
homepage: URL             # 项目主页
metadata:
  openclaw:
    emoji: 🎨             # Emoji 标识
    requires:             # 依赖要求
      bins: []            # 需要的命令行工具
      env: []             # 需要的环境变量
    primaryEnv: XXX       # 主要环境变量
    install: []           # 安装步骤
    mcpServers: []        # MCP 服务器
    capabilities: []      # 能力标签
    outputFormats: []     # 输出格式
    frameworks: []        # 支持的框架
    languages: []         # 支持的语言
    platforms: []         # 支持的平台
    tools: []             # 支持的工具
```

---

## 🎯 7 个 Claw Skills 的 Metadata

### 1. Designer Claw 🎨

```yaml
name: designer-claw
emoji: 🎨
requires:
  bins: [mcporter]
  env: [FIGMA_ACCESS_TOKEN]
install:
  - mcporter (MCP manager)
  - @modelcontextprotocol/server-figma
mcpServers: [figma]
capabilities:
  - design-tokens
  - image-generation
  - responsive-design
```

**自动安装：**
```bash
npm install -g mcporter @modelcontextprotocol/server-figma
mcporter auth figma
```

---

### 2. Architect Claw 🏗️

```yaml
name: architect-claw
emoji: 🏗️
requires: {}  # 无需额外安装
capabilities:
  - mermaid-diagrams
  - architecture-design
  - performance-optimization
outputFormats:
  - mermaid
  - markdown
  - ascii-art
```

**内置工具：**
- Mermaid（纯文本，无需安装）
- Markdown 渲染

---

### 3. Tester Claw 🧪

```yaml
name: tester-claw
emoji: 🧪
requires:
  bins: [npx]
install:
  - @playwright/test
frameworks:
  - playwright
  - jest
  - vitest
capabilities:
  - e2e-testing
  - unit-testing
  - coverage-analysis
  - test-generation
```

**自动安装：**
```bash
npm install -D @playwright/test
npx playwright install
```

---

### 4. DevOps Claw 🚀

```yaml
name: devops-claw
emoji: 🚀
requires:
  bins: [docker]
install:
  - docker (brew)
  - kubectl (brew)
platforms:
  - docker
  - kubernetes
  - vercel
  - aws
  - gcp
  - azure
capabilities:
  - docker
  - kubernetes
  - ci-cd
  - monitoring
  - deployment
```

**建议安装：**
```bash
brew install --cask docker
brew install kubectl
```

---

### 5. PM Claw 📋

```yaml
name: pm-claw
emoji: 📋
requires:
  bins: [mcporter]
  env: [LINEAR_API_KEY]
install:
  - mcporter (MCP manager)
  - @modelcontextprotocol/server-linear
mcpServers: [linear]
capabilities:
  - requirement-analysis
  - task-decomposition
  - project-management
```

**自动安装：**
```bash
npm install -g mcporter @modelcontextprotocol/server-linear
mcporter auth linear
```

---

### 6. Dev Claw 💻

```yaml
name: dev-claw
emoji: 💻
requires:
  bins: [git, gh]
install:
  - gh (GitHub CLI)
languages:
  - typescript
  - javascript
  - python
  - go
  - rust
capabilities:
  - code-implementation
  - debugging
  - optimization
  - git-workflow
```

**建议安装：**
```bash
brew install gh
gh auth login
```

---

### 7. Reviewer Claw 🔍

```yaml
name: reviewer-claw
emoji: 🔍
requires:
  bins: [npx]
tools:
  - eslint
  - prettier
  - sonarqube
capabilities:
  - code-review
  - security-analysis
  - performance-review
  - best-practices
```

**内置工具：**
- ESLint（通常已随项目安装）
- Prettier
- TypeScript Compiler

**可选工具：**
```bash
brew install sonar-scanner
npm install -g snyk
```

---

## 🔧 安装类型

### 1. Node.js 包（自动安装）

```json
{
  "id": "package-name",
  "kind": "node",
  "package": "package-name",
  "bins": ["command"],
  "label": "Install Package"
}
```

**执行：**
```bash
npm install -g package-name
```

---

### 2. Homebrew 包（建议安装）

```json
{
  "id": "brew-package",
  "kind": "brew",
  "formula": "package",
  "bins": ["command"],
  "label": "Install via brew",
  "optional": true
}
```

**执行：**
```bash
brew install package
```

---

### 3. MCP 服务器（需要认证）

```json
{
  "mcpServers": ["figma", "linear"]
}
```

**执行：**
```bash
npm install -g @modelcontextprotocol/server-figma
mcporter auth figma
```

---

## 🚀 使用流程

### 自动安装流程

1. **用户调用 skill**
   ```
   "Designer Claw, 帮我设计登录页面"
   ```

2. **OpenClaw 检查依赖**
   - 检查 `mcporter` 是否安装
   - 检查 `FIGMA_ACCESS_TOKEN` 是否设置

3. **自动安装缺失的工具**
   ```bash
   npm install -g mcporter @modelcontextprotocol/server-figma
   ```

4. **提示用户认证**
   ```
   首次使用需要认证 Figma，请运行：
   mcporter auth figma
   ```

5. **执行任务**
   - 读取 Figma 设计
   - 生成代码

---

### 手动安装流程

**对于需要用户确认的安装（如 Docker）：**

1. **OpenClaw 提示**
   ```
   DevOps Claw 需要 Docker Desktop。
   是否安装？(需要用户确认)
   
   执行命令：
   brew install --cask docker
   ```

2. **用户确认后安装**

3. **继续执行任务**

---

## 📊 依赖关系图

```
Designer Claw ──┐
                ├──> mcporter ──> Figma MCP
PM Claw ────────┘                 Linear MCP

Architect Claw ──> (无依赖)

Tester Claw ──> Playwright
                Jest

DevOps Claw ──> Docker
                kubectl

Dev Claw ──> Git
             GitHub CLI

Reviewer Claw ──> ESLint
                  Prettier
```

---

## 🎯 最佳实践

### 1. 环境变量管理

**推荐使用 `.env` 文件：**
```bash
# ~/.openclaw/.env
FIGMA_ACCESS_TOKEN=figd_xxx
LINEAR_API_KEY=lin_api_xxx
OPENAI_API_KEY=sk-xxx
```

---

### 2. MCP 认证

**一次性认证所有 MCP 服务器：**
```bash
# Figma
mcporter auth figma

# Linear
mcporter auth linear

# GitHub
mcporter auth github
```

---

### 3. 验证安装

**检查所有工具是否正确安装：**
```bash
# 检查 MCP 工具
mcporter list

# 检查开发工具
docker --version
kubectl version --client
gh --version
git --version
```

---

## 📚 参考资料

### OpenClaw Skill 开发
- [Skill Metadata 规范](https://docs.openclaw.ai/skills/metadata)
- [安装配置指南](https://docs.openclaw.ai/skills/install)

### MCP 相关
- [MCP 官方文档](https://modelcontextprotocol.io/)
- [mcporter 文档](http://mcporter.dev)
- [可用 MCP 服务器列表](https://github.com/modelcontextprotocol/servers)

---

**所有 Claw Skills 都已配置完整的 metadata 和自动安装！** 🎉

---

*创建时间: 2026-03-20 16:12*
*版本: 1.0*
