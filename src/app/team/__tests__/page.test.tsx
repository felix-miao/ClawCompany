import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import TeamChatPage from '../page'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Team Chat Page (/team)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({
      json: async () => ({ success: true, message: 'Test response' })
    })
  })

  describe('渲染测试', () => {
    it('应该渲染页面标题', () => {
      render(<TeamChatPage />)
      expect(screen.getByText(/AI Team/i)).toBeInTheDocument()
    })

    it('应该显示三个 Agent', () => {
      render(<TeamChatPage />)
      // 检查 agent 角色描述
      expect(screen.getByText('产品经理')).toBeInTheDocument()
      expect(screen.getByText('开发者')).toBeInTheDocument()
      expect(screen.getByText('审查员')).toBeInTheDocument()
    })

    it('应该显示输入框', () => {
      render(<TeamChatPage />)
      expect(screen.getByPlaceholderText(/输入你的需求/i)).toBeInTheDocument()
    })

    it('应该显示发送按钮', () => {
      render(<TeamChatPage />)
      expect(screen.getByRole('button', { name: /发送/i })).toBeInTheDocument()
    })

    it('应该显示返回首页链接', () => {
      render(<TeamChatPage />)
      expect(screen.getByRole('link', { name: /返回首页/i })).toBeInTheDocument()
    })
  })

  describe('交互测试', () => {
    it('输入框应该可以输入文字', () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      
      fireEvent.change(input, { target: { value: '测试消息' } })
      
      expect(input).toHaveValue('测试消息')
    })

    it('空消息不应该触发发送', async () => {
      render(<TeamChatPage />)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.click(sendButton)
      
      // 不应该调用 fetch
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('发送消息应该调用 API', async () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '创建登录页面' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/agent', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }))
      })
    })

    it('发送后应该清空输入框', async () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('加载中应该禁用发送按钮', async () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      // 立即检查按钮状态
      expect(sendButton).toBeDisabled()
    })

    it('按 Enter 键应该发送消息', async () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)

      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
    })
  })

  describe('消息显示测试', () => {
    it('发送消息后应该显示用户消息', async () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '创建登录页面' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('创建登录页面')).toBeInTheDocument()
      })
    })

    it('应该显示正在处理的消息', async () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '测试消息' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/正在分析需求/i)).toBeInTheDocument()
      })
    })
  })

  describe('错误处理测试', () => {
    it('API 错误应该显示错误消息', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '测试消息' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('API 返回失败应该显示错误', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: false, error: 'Invalid request' })
      })
      
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      
      fireEvent.change(input, { target: { value: '测试消息' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid request/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('可访问性测试', () => {
    it('输入框应该有正确的 aria-label', () => {
      render(<TeamChatPage />)
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      expect(input).toHaveAttribute('aria-label')
    })

    it('发送按钮应该有正确的 type', () => {
      render(<TeamChatPage />)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      expect(sendButton).toHaveAttribute('type', 'button')
    })
  })
})
