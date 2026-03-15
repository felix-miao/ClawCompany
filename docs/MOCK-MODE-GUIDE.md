# 🎬 Mock Mode 使用指南

## 快速开始

### 1. 启用 Mock 模式

编辑 `.env.local` 文件，添加：

```bash
USE_MOCK_LLM=true
```

### 2. 启动开发服务器

```bash
cd ai-team-demo
./dev.sh
```

### 3. 录制 Demo

访问 http://localhost:3000，按照 `DEMO-STORYBOARD.md` 的步骤录制。

### 4. 恢复真实 API

录制完成后，删除或注释掉 `USE_MOCK_LLM=true`：

```bash
# USE_MOCK_LLM=true
```

## Mock Provider 特性

### ✅ 优点
- **快速响应**：<1 秒（真实 GLM API 需要 60+ 秒）
- **稳定可靠**：不会因为网络或 API 问题失败
- **智能响应**：根据关键词返回预设的智能回复
- **支持 streaming**：逐字符返回，模拟打字效果

### 📋 支持的场景
- 登录页面（login）
- 计算器（calculator）
- 表单（form）
- 其他通用需求（自动生成任务）

### ⚠️ 注意事项
- Mock 模式**仅用于 demo 录制**
- 实际使用时请**关闭 Mock 模式**
- Mock 响应是预设的，不会真正生成代码

## Demo 录制检查清单

### 准备工作
- [ ] 启用 `USE_MOCK_LLM=true`
- [ ] 启动 dev server：`./dev.sh`
- [ ] 访问 http://localhost:3000
- [ ] 测试一下：输入"创建一个登录页面"，确认响应快速

### 录制中
- [ ] 按照 `DEMO-STORYBOARD.md` 的步骤
- [ ] 鼠标移动要慢
- [ ] 操作要有停顿
- [ ] 等待动画完成

### 录制后
- [ ] 关闭 Mock 模式（删除 `USE_MOCK_LLM=true`）
- [ ] 重启 dev server
- [ ] 测试真实 API 是否正常

## 常见问题

### Q: Mock 模式下会调用真实的 GLM API 吗？
**A:** 不会。Mock 模式完全跳过 API 调用，使用预设的响应。

### Q: Mock 响应的质量如何？
**A:** Mock 响应经过精心设计，包含：
- 智能的任务拆分
- 合理的任务分配
- Markdown 格式的友好消息
- 符合实际工作流的逻辑

### Q: 可以自定义 Mock 响应吗？
**A:** 可以！编辑 `ai-team-demo/src/lib/llm/mock.ts`，修改对应的方法：
- `getLoginResponse()` - 登录相关
- `getCalculatorResponse()` - 计算器相关
- `getFormResponse()` - 表单相关
- `getDefaultResponse()` - 其他需求

---

**准备好了吗？** 开始录制你的 Demo 吧！🎬
