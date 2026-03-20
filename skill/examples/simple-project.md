# 示例 1: 简单项目 - 创建登录页面

## 用户需求

```
创建一个现代化的登录页面，包含：
- 邮箱和密码输入框
- 记住我选项
- 忘记密码链接
- 响应式设计
```

## ClawCompany 执行流程

### Step 1: PM Agent 分析

OpenClaw 自动调用 PM Agent:

```typescript
sessions_spawn({
  task: `
    分析需求并制定开发计划:
    
    需求: 创建一个现代化的登录页面
    - 邮箱和密码输入框
    - 记住我选项
    - 忘记密码链接
    - 响应式设计
    
    请提供:
    1. 任务拆分（3-5 个子任务）
    2. 技术选型建议
    3. 预估时间
  `,
  runtime: "subagent",
  model: "zai/glm-5",
  mode: "run",
  timeoutSeconds: 300
})
```

**PM Agent 响应:**

```
📋 需求分析完成

任务拆分:
1. 创建页面结构和布局组件 (15分钟)
2. 实现表单验证逻辑 (10分钟)
3. 添加响应式样式 (10分钟)
4. 实现交互功能（记住我、忘记密码）(10分钟)
5. 添加无障碍支持 (5分钟)

技术选型:
- 框架: React + TypeScript
- 样式: Tailwind CSS
- 表单: React Hook Form
- 验证: Zod

预估总时间: 50 分钟
```

---

### Step 2: Dev Agent 实现

OpenClaw 调用 Dev Agent (使用 Codex):

```typescript
sessions_spawn({
  task: `
    根据以下任务实现登录页面:
    
    任务拆分:
    1. 创建页面结构和布局组件
    2. 实现表单验证逻辑
    3. 添加响应式样式
    4. 实现交互功能
    5. 添加无障碍支持
    
    技术栈: React + TypeScript + Tailwind CSS
    
    请创建所有必要的文件。
  `,
  runtime: "acp",
  agentId: "codex",
  mode: "run",
  timeoutSeconds: 600
})
```

**Dev Agent 输出:**

```
✅ 创建文件: src/components/LoginPage.tsx
✅ 创建文件: src/types/auth.ts
✅ 创建文件: src/hooks/useLoginForm.ts
✅ 创建文件: src/validations/auth.schema.ts

实现内容:
- ✅ 响应式布局（桌面/平板/手机）
- ✅ 表单验证（邮箱格式、密码长度）
- ✅ 记住我功能（localStorage）
- ✅ 忘记密码链接
- ✅ 无障碍支持（ARIA 标签）
- ✅ TypeScript 类型定义
```

---

### Step 3: Review Agent 审查

OpenClaw 调用 Review Agent:

```typescript
sessions_spawn({
  task: `
    审查登录页面代码:
    
    文件列表:
    - src/components/LoginPage.tsx
    - src/types/auth.ts
    - src/hooks/useLoginForm.ts
    - src/validations/auth.schema.ts
    
    请检查:
    1. 代码质量
    2. 安全性
    3. 性能
    4. 最佳实践
    5. 可访问性
  `,
  runtime: "subagent",
  model: "zai/glm-5",
  mode: "run",
  timeoutSeconds: 300
})
```

**Review Agent 报告:**

```
🔍 代码审查报告

✅ 优点:
- 代码结构清晰，组件划分合理
- 使用 TypeScript 提供类型安全
- 响应式设计实现良好
- 表单验证逻辑完善
- ARIA 标签齐全

⚠️ 建议改进:
1. 添加密码强度提示
2. 考虑添加防暴力破解（rate limiting）
3. 添加错误边界处理
4. 优化输入框焦点管理

🔒 安全检查:
- ✅ 密码输入使用 type="password"
- ✅ 防止 XSS（React 自动转义）
- ⚠️ 建议添加 CSRF token

📊 性能:
- ✅ 使用 React.memo 优化
- ✅ 懒加载非关键组件
- ✅ 样式使用 Tailwind（零运行时）

总体评分: 8.5/10 ⭐
```

---

### Step 4: 最终交付

OpenClaw 汇总所有结果:

```
📦 项目交付清单

创建文件:
├── src/
│   ├── components/
│   │   └── LoginPage.tsx       (主组件, 120 行)
│   ├── types/
│   │   └── auth.ts            (类型定义, 15 行)
│   ├── hooks/
│   │   └── useLoginForm.ts    (自定义 Hook, 45 行)
│   └── validations/
│       └── auth.schema.ts     (验证规则, 20 行)

功能清单:
✅ 邮箱和密码输入
✅ 表单验证
✅ 记住我功能
✅ 忘记密码链接
✅ 响应式设计
✅ 无障碍支持
✅ TypeScript 类型
✅ 单元测试（建议添加）

技术栈:
- React 18
- TypeScript 5
- Tailwind CSS 3
- React Hook Form
- Zod

下一步建议:
1. 添加单元测试
2. 集成后端 API
3. 添加错误边界
4. 实施密码强度提示

✨ 任务完成！
```

---

## 使用方式

### 在 OpenClaw 中调用

直接向 OpenClaw 描述需求:

```
创建一个现代化的登录页面，包含邮箱和密码输入框、记住我选项、
忘记密码链接，要求响应式设计。
```

OpenClaw 会自动:
1. 识别这是 ClawCompany skill 的任务
2. 调用 PM Agent 分析需求
3. 调用 Dev Agent 生成代码
4. 调用 Review Agent 审查质量
5. 返回完整的交付物

### 自定义配置

可以指定技术栈和偏好:

```
使用 Vue 3 + Composition API 创建登录页面，
样式使用 UnoCSS，表单验证使用 VeeValidate。
```

---

## 预期效果

**开发效率:**
- 传统开发: 2-3 小时
- ClawCompany: 5-10 分钟
- 效率提升: **12-36 倍** 🚀

**代码质量:**
- 自动遵循最佳实践
- TypeScript 类型安全
- 响应式和无障碍支持
- 通过 AI 审查

**可维护性:**
- 清晰的文件结构
- 类型定义完整
- 易于扩展和修改

---

这个示例展示了 ClawCompany 如何通过 OpenClaw 的原生工具（sessions_spawn, sessions_send, sessions_yield）实现真实的 AI 团队协作。
