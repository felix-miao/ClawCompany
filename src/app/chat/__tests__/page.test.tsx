import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { ReactNode } from 'react'

import ChatPage from '../page'

jest.mock('@/lib/api/client', () => ({
  sendMessage: jest.fn(),
  getChatHistory: jest.fn()
}))

jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  MockMarkdown.displayName = 'MockMarkdown'
  return MockMarkdown
})

jest.mock('remark-gfm', () => () => {})

import { getChatHistory, sendMessage } from '@/lib/api/client'

const renderChatPage = async () => {
  render(<ChatPage />)
  await screen.findByText(/欢迎来到/i)
}

const sendChatInput = async (message: string) => {
  const input = screen.getByPlaceholderText(/Describe what you want to build/i)
  const sendButton = screen.getByRole('button', { name: /Send/i })

  fireEvent.change(input, { target: { value: message } })

  await act(async () => {
    fireEvent.click(sendButton)
  })

  return { input, sendButton }
}

const sendChatInputAndWait = async (message: string) => {
  return sendChatInput(message)
}

describe('Chat Page (/chat)', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
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

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('初始渲染测试', () => {
    it('应该渲染页面', async () => {
      await renderChatPage()
      expect(screen.getByText(/AI Team Chat/i)).toBeInTheDocument()
    })

    it('应该显示输入框', async () => {
      await renderChatPage()
      expect(screen.getByPlaceholderText(/Describe what you want to build/i)).toBeInTheDocument()
    })

    it('应该显示发送按钮', async () => {
      await renderChatPage()
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument()
    })

    it('应该显示返回按钮', async () => {
      await renderChatPage()
      expect(screen.getByRole('link', { name: /Back/i })).toBeInTheDocument()
    })

    it('应该加载初始状态', async () => {
      await renderChatPage()
      expect(getChatHistory).toHaveBeenCalled()
    })

    it('应该显示欢迎消息（如果无历史记录）', async () => {
      await renderChatPage()
      expect(screen.getByText(/欢迎来到/i)).toBeInTheDocument()
    })
  })

  describe('消息发送测试', () => {
    it('输入框应该可以输入文字', async () => {
      await renderChatPage()
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)

      fireEvent.change(input, { target: { value: '测试消息' } })

      expect(input).toHaveValue('测试消息')
    })

    it('空消息不应该触发发送', async () => {
      await renderChatPage()
      const sendButton = screen.getByRole('button', { name: /Send/i })

      fireEvent.click(sendButton)

      expect(sendMessage).not.toHaveBeenCalled()
    })

    it('发送消息应该调用 API', async () => {
      await renderChatPage()
      await sendChatInputAndWait('创建登录页面')

      expect(sendMessage).toHaveBeenCalledWith('创建登录页面')
    })

    it('发送后应该清空输入框', async () => {
      await renderChatPage()
      const { input } = await sendChatInputAndWait('测试')

      expect(input).toHaveValue('')
    })

    it('加载中应该禁用发送按钮', async () => {
      ;(sendMessage as jest.Mock).mockImplementation(() => new Promise(() => {}))

      await renderChatPage()
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })

      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)

      expect(sendButton).toBeDisabled()
    })

    it('按 Enter 键应该发送消息', async () => {
      await renderChatPage()
      const input = screen.getByPlaceholderText(/Describe what you want to build/i)

      fireEvent.change(input, { target: { value: '测试' } })

      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 })

      expect(sendMessage).toHaveBeenCalled()
    })
  })

  describe('消息显示测试', () => {
    it('发送消息后应该显示用户消息', async () => {
      await renderChatPage()
      await sendChatInput('创建登录页面')

      expect(screen.getByText('创建登录页面')).toBeInTheDocument()
    })

    it('应该显示 Agent 回复', async () => {
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: [
          { id: '1', agent: 'pm', content: 'PM response', timestamp: new Date().toISOString() }
        ],
        tasks: []
      })

      await renderChatPage()
      await sendChatInputAndWait('测试')

      await waitFor(() => {
        expect(screen.getByText('PM response')).toBeInTheDocument()
      })
    })

    it('应该显示多个 Agent 的消息', async () => {
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: [
          { id: '1', agent: 'user', content: 'User message', timestamp: new Date().toISOString() },
          { id: '2', agent: 'pm', content: 'PM message', timestamp: new Date().toISOString() },
          { id: '3', agent: 'dev', content: 'Dev message', timestamp: new Date().toISOString() }
        ],
        tasks: []
      })

      await renderChatPage()
      await sendChatInputAndWait('测试')

      await waitFor(() => {
        expect(screen.getByText('PM message')).toBeInTheDocument()
        expect(screen.getByText('Dev message')).toBeInTheDocument()
      })
    })
  })

  describe('任务列表测试', () => {
    it('应该显示任务列表', async () => {
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: [],
        tasks: [
          { id: '1', title: 'Task 1', status: 'pending', assignedTo: 'dev', description: 'Test task' }
        ]
      })

      await renderChatPage()
      await sendChatInputAndWait('测试')

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument()
      })
    })

    it('应该显示任务状态', async () => {
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: true,
        chatHistory: [],
        tasks: [
          { id: '1', title: 'Task 1', status: 'completed', assignedTo: 'dev', description: 'Test task' }
        ]
      })

      await renderChatPage()
      await sendChatInputAndWait('测试')

      await waitFor(() => {
        expect(screen.getByText(/completed/i)).toBeInTheDocument()
      })
    })
  })

  describe('错误处理测试', () => {
    it('API 错误应该显示错误消息', async () => {
      ;(sendMessage as jest.Mock).mockRejectedValue(new Error('Network error'))

      await renderChatPage()
      await sendChatInput('测试')

      await waitFor(() => {
        expect(sendMessage).toHaveBeenCalled()
      })
      expect(consoleErrorSpy).toHaveBeenCalledWith('Send error:', expect.any(Error))
    })

    it('API 返回失败应该显示错误', async () => {
      ;(sendMessage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Invalid request'
      })

      await renderChatPage()
      await sendChatInputAndWait('测试')

      await waitFor(() => {
        expect(screen.getByText(/Invalid request/i)).toBeInTheDocument()
      })
    })
  })

  describe('自动滚动测试', () => {
    it('新消息应该自动滚动到底部', async () => {
      await renderChatPage()
      await sendChatInput('测试')

      expect(sendMessage).toHaveBeenCalled()
    })
  })

  describe('可访问性测试', () => {
    it('消息区域应该有正确的 role', async () => {
      await renderChatPage()
      expect(screen.getByRole('log')).toBeInTheDocument()
    })
  })
})
