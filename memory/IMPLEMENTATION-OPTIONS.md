# ClawCompany 实现方案选择

## 两种方案

### 方案 A：OpenClaw Skill（纯文档）

**特点：**
- ✅ 只需要 SKILL.md
- ✅ OpenClaw 自动理解并执行
- ✅ 发布到 ClawHub
- ❌ 不能独立运行
- ❌ 依赖 OpenClaw 环境

**实现：**
- 只写 SKILL.md
- 描述清楚 PM/Dev/Review 如何协作
- OpenClaw 根据 prompt 自动调用

---

### 方案 B：独立 CLI 工具

**特点：**
- ✅ 可以独立运行
- ✅ 不依赖 OpenClaw 环境
- ❌ 需要自己实现 LLM 调用
- ❌ 不能利用 OpenClaw 的 sessions_spawn

**实现：**
- 需要 npm 包调用 GLM API
- 需要自己集成 OpenCode
- 完整的 Node.js 应用

---

### 方案 C：OpenClaw Plugin（混合）

**特点：**
- ✅ 可以独立运行
- ✅ 可以访问 OpenClaw API
- ✅ 发布到 ClawHub
- ⚠️ 需要正确的 API 访问方式

**实现：**
- 需要找到 OpenClaw 的 npm 包
- 或通过 openclaw 命令行工具
- 真实的 sessions_spawn 调用

---

## 问题

**我不知道：**
1. OpenClaw 是否有公开的 npm 包？
2. Skill 是否可以访问 OpenClaw 的内部 API？
3. 你想要哪种方案？

**请告诉我：**
- 你想要独立 CLI？还是 OpenClaw Skill？
- 还是要两者都要？

---

*时间: 17:22*
