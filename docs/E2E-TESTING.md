# E2E 测试指南

## 安装 Playwright 浏览器

```bash
cd /Users/felixmiao/Projects/ClawCompany/ai-team-demo

# 安装浏览器（可能需要几分钟）
npx playwright install chromium

# 如果下载慢，可以尝试使用国内镜像
# PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright npx playwright install chromium
```

## 运行 E2E 测试

### 方式 1：运行所有测试

```bash
# 确保 dev server 在运行（http://localhost:3000）
npm run dev &

# 运行 E2E 测试
npm run test:e2e
```

### 方式 2：使用 UI 模式（推荐用于调试）

```bash
npm run test:e2e:ui
```

### 方式 3：调试模式

```bash
npm run test:e2e:debug
```

## 测试内容

当前 E2E 测试覆盖：

1. ✅ **Landing Page 测试**
   - 页面正常显示
   - 3 个 Agent 卡片显示
   - CTA 按钮可点击

2. ✅ **Team Portal 测试**
   - 页面正常显示
   - 聊天界面显示
   - 3 个 Agent 显示
   - 输入框和按钮交互

3. ✅ **协作流程测试**
   - 输入需求
   - PM Agent 响应
   - Dev Agent 响应
   - Review Agent 响应
   - 完成消息显示

4. ✅ **交互测试**
   - 空输入不触发发送
   - 输入内容后启用按钮
   - Loading 状态显示

## 查看测试报告

```bash
# 测试完成后，查看 HTML 报告
npx playwright show-report
```

## 测试结果

运行 `npm run test:e2e` 后，你会看到：

- ✅ 通过的测试（绿色）
- ❌ 失败的测试（红色）
- 📊 测试覆盖率报告

## 故障排查

### 问题 1：浏览器下载失败

**解决方案：**
```bash
# 使用国内镜像
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright npx playwright install chromium
```

### 问题 2：Dev server 未启动

**解决方案：**
```bash
# 先启动 dev server
npm run dev

# 在另一个终端运行测试
npm run test:e2e
```

### 问题 3：端口被占用

**解决方案：**
```bash
# 修改 playwright.config.ts 中的 baseURL
baseURL: 'http://localhost:3001'
```

## 下一步

1. **运行测试**：`npm run test:e2e`
2. **查看报告**：检查哪些测试通过/失败
3. **修复问题**：根据测试结果修复代码
4. **重新测试**：确保所有测试通过

---

**当前状态：** E2E 测试框架已就绪，等待浏览器下载完成后即可运行测试！
