// Mock Provider - 用于 Demo 的快速响应提供者

import { LLMProvider, ChatMessage } from './types'

export class MockProvider implements LLMProvider {
  async chat(messages: ChatMessage[]): Promise<string> {
    // 模拟网络延迟（200-500ms）
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200))

    // 获取用户消息
    const userMessage = messages.find(m => m.role === 'user')?.content || ''
    
    // 根据关键词返回预设的智能响应
    if (userMessage.includes('登录') || userMessage.includes('login')) {
      return this.getLoginResponse()
    }
    
    if (userMessage.includes('计算器') || userMessage.includes('calculator')) {
      return this.getCalculatorResponse()
    }
    
    if (userMessage.includes('表单') || userMessage.includes('form')) {
      return this.getFormResponse()
    }
    
    // 默认响应
    return this.getDefaultResponse(userMessage)
  }

  async *stream(messages: ChatMessage[]): AsyncGenerator<string> {
    const response = await this.chat(messages)
    // 逐字符返回，模拟打字效果
    for (const char of response) {
      yield char
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  private getLoginResponse(): string {
    return JSON.stringify({
      analysis: "用户需要创建一个登录页面，包含用户名、密码输入和登录按钮。",
      tasks: [
        {
          title: "创建登录表单组件",
          description: "实现包含用户名、密码输入框和登录按钮的表单组件",
          assignedTo: "dev",
          dependencies: []
        },
        {
          title: "添加表单验证",
          description: "实现用户名和密码的输入验证逻辑",
          assignedTo: "dev",
          dependencies: ["创建登录表单组件"]
        },
        {
          title: "实现登录 API",
          description: "创建后端登录接口，验证用户凭据",
          assignedTo: "dev",
          dependencies: []
        },
        {
          title: "代码审查",
          description: "审查登录功能的代码质量和安全性",
          assignedTo: "review",
          dependencies: ["创建登录表单组件", "添加表单验证", "实现登录 API"]
        }
      ],
      message: `## 📝 执行计划已生成

我已经分析了创建登录页面的需求。这是一个常见的前端功能，我们将它拆解为 **界面构建**、**表单验证** 和 **后端集成** 三个阶段。

### 🚀 任务概览：
1. **Dev**: 首先创建登录表单的 UI 组件
2. **Dev**: 接着添加表单验证逻辑
3. **Dev**: 同时实现后端登录 API
4. **Review**: 最后进行代码审查和安全检查

### 📋 任务分配：
- **Dev Agent** 将负责前端组件和后端 API 的实现
- **Review Agent** 将确保代码质量和安全性

Dev Agent，请开始实现第一个任务：**创建登录表单组件** 🎨`
    })
  }

  private getCalculatorResponse(): string {
    return JSON.stringify({
      analysis: "用户需要创建一个简单的计算器应用，支持基本的加减乘除运算。",
      tasks: [
        {
          title: "创建计算器 UI",
          description: "实现计算器的界面布局，包含数字按钮和运算符",
          assignedTo: "dev",
          dependencies: []
        },
        {
          title: "实现计算逻辑",
          description: "编写加减乘除的运算逻辑",
          assignedTo: "dev",
          dependencies: ["创建计算器 UI"]
        },
        {
          title: "代码审查",
          description: "审查计算器功能的正确性和代码质量",
          assignedTo: "review",
          dependencies: ["创建计算器 UI", "实现计算逻辑"]
        }
      ],
      message: `## 📝 执行计划已生成

我已经分析了创建简单计算器的需求。这是一个经典的前端入门项目，我们将它拆解为 **界面构建** 和 **逻辑实现** 两个阶段。

### 🚀 任务概览：
1. **Dev**: 首先搭建计算器的 UI 界面
2. **Dev**: 接着实现计算逻辑
3. **Review**: 最后进行代码审查

### 📋 任务分配：
- **Dev Agent** 将负责 UI 和逻辑的实现
- **Review Agent** 将确保功能正确性

Dev Agent，请开始实现第一个任务：**创建计算器 UI** 🧮`
    })
  }

  private getFormResponse(): string {
    return JSON.stringify({
      analysis: "用户需要创建一个表单组件，可能包含输入框、选择器等元素。",
      tasks: [
        {
          title: "创建表单组件",
          description: "实现表单的基础结构和样式",
          assignedTo: "dev",
          dependencies: []
        },
        {
          title: "添加表单验证",
          description: "实现表单输入的验证逻辑",
          assignedTo: "dev",
          dependencies: ["创建表单组件"]
        },
        {
          title: "代码审查",
          description: "审查表单组件的代码质量",
          assignedTo: "review",
          dependencies: ["创建表单组件", "添加表单验证"]
        }
      ],
      message: `## 📝 执行计划已生成

我已经分析了创建表单的需求。这是一个通用的 UI 组件，我们将它拆解为 **界面构建** 和 **验证逻辑** 两个阶段。

### 🚀 任务概览：
1. **Dev**: 首先创建表单的 UI 结构
2. **Dev**: 接着添加表单验证
3. **Review**: 最后进行代码审查

Dev Agent，请开始实现第一个任务：**创建表单组件** 📝`
    })
  }

  private getDefaultResponse(userMessage: string): string {
    return JSON.stringify({
      analysis: `用户需求：${userMessage}`,
      tasks: [
        {
          title: "实现核心功能",
          description: "根据需求实现主要功能",
          assignedTo: "dev",
          dependencies: []
        },
        {
          title: "代码审查",
          description: "审查代码质量",
          assignedTo: "review",
          dependencies: ["实现核心功能"]
        }
      ],
      message: `## 📝 执行计划已生成

我已经分析了您的需求：**${userMessage}**

### 🚀 任务概览：
1. **Dev**: 实现核心功能
2. **Review**: 进行代码审查

Dev Agent，请开始实现：**实现核心功能** 🎯`
    })
  }
}
