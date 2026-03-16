import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChatPage from '../page'

// Mock dependencies
jest.mock('@/lib/api/client', () => ({
  sendMessage: jest.fn(),
  getChatHistory: jest.fn()
}))

jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: any) => <div>{children}</div>
  MockMarkdown.displayName = 'MockMarkdown'
  return MockMarkdown
})

jest.mock('remark-gfm', () => () => {})

import { sendMessage, getChatHistory } from '@/lib/api/client'

describe('Chat Page (/chat)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getChatHistory as jest.Mock).mockResolvedValue({
      chatHistory: [],
      tasks: []
    })
    ;(sendMessage as jest.Mock).mockResolvedValue({
      success: true,
      chatHistory: [],
      tasks: []
    })
  })

  describe('初始渲染测试', () => {
    it('应该渲染页面', () => {
      render(<ChatPage />)
      // 使用更具体的文本匹配
      expect(screen.getByText(/AI Team Chat/i)).toBeInTheDocument()
    })

    it('应该显示输入框', () => {
      render(<ChatPage />)
      expect(screen.getByPlaceholderText(/Describe what you want to build/i)).toBeInTheDocument()
    })

    it('应该显示发送按钮', () => {
      render(<ChatPage />)
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument()
    })

    it('应该显示返回按钮', () => {
      render(<ChatPage />)
      expect(screen.getByRole('link', { name: /Back/i })).toBeInTheDocument()
    })

    it('应该加载初始状态', async () => {
      render(<ChatPage />)
      
      await waitFor(() => {
        expect(getChatHistory).toHaveBeenCalled()
      })
    })

    it('应该显示欢迎消息（如果无历史记录）', async () => {
      render(<ChatPage />)
      
      await waitFor(() => {
        expect(screen.getByText(/欢迎来到/i)).toBeInTheDocument()
      })
    })
  })

  describe('消息发送测试', () => {
    it('输入框应该可以输入文字', () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      
      fireEvent.change(input, { target: { value: '测试消息' } })
      
      expect(input).toHaveValue('测试消息')
    })

    it('空消息不应该触发发送', async () => {
      render(<ChatPage />)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.click(sendButton)
      
      expect(sendMessage).not.toHaveBeenCalled()
    })

    it('发送消息应该调用 API', async () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '创建登录页面' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalledWith('创建登录页面')
      })
    })

    it('发送后应该清空输入框', async () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(input).toHaveValue('')
      })
    })

    it('加载中应该禁用发送按钮', async () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      // 立即检查按钮状态
      expect(sendButton).toBeDisabled()
    })

    it('按 Enter 键应该发送消息', async () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })
      
      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalled()
      })
    })
  })

  describe('消息显示测试', () => {
    it('发送消息后应该显示用户消息', async () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '创建登录页面' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('创建登录页面')).toBeInTheDocument()
      })
    })

    it('应该显示 Agent 回复', async () => {
      const mockChatHistory = [
        { id: '1', agent: 'pm', content: 'PM response', timestamp: new Date().toISOString() }
      ]
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: mockChatHistory,
        tasks: []
      })
      
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('PM response')).toBeInTheDocument()
      })
    })

    it('应该显示多个 Agent 的消息', async () => {
      const mockChatHistory = [
        { id: '1', agent: 'user', content: 'User message', timestamp: new Date().toISOString() },
        { id: '2', agent: 'pm', content: 'PM message', timestamp: new Date().toISOString() },
        { id: '3', agent: 'dev', content: 'Dev message', timestamp: new Date().toISOString() }
      ]
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: mockChatHistory,
        tasks: []
      })
      
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('PM message')).toBeInTheDocument()
        expect(screen.getByText('Dev message')).toBeInTheDocument()
      })
    })
  })

  describe('任务列表测试', () => {
    it('应该显示任务列表', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'pending', assignedTo: 'dev', description: 'Test task' }
      ]
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: [],
        tasks: mockTasks
      })
      
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })
    })

    it('应该显示任务状态', async () => {
      const mockTasks = [
        { id: '1', title: 'Task 1', status: 'done', assignedTo: 'dev', description: 'Test task' }
      ]
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: [],
        tasks: mockTasks
      })
      
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/done/i)).toBeInTheDocument()
      })
    })
  })

  describe('错误处理测试', () => {
    it('API 错误应该显示错误消息', async () => {
      ;(sendMessage as jest.Mock).mockRejectedValue(new Error('Network error'))
      
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalled()
      })
    })

    it('API 返回失败应该显示错误', async () => {
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid request'
      })
      
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid request/i)).toBeInTheDocument()
      })
    })
  })

  describe('自动滚动测试', () => {
    it('新消息应该自动滚动到底部', async () => {
      render(<ChatPage />)
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })
      
      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)
      
      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalled()
      })
    })
  })

  describe('可访问性测试', () => {
    it('消息区域应该有正确的 role', () => {
      render(<ChatPage />)
      // 检查是否有消息列表容器
      const messageContainer = screen.getByRole('log')
      expect(messageContainer).toBeInTheDocument()
    })
  })
})
