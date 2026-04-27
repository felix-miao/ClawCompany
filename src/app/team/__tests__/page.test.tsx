import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import TeamChatPage from '../page'

const mockFetch = jest.fn()
global.fetch = mockFetch

const renderTeamPage = async () => {
  render(<TeamChatPage />)
  await waitFor(() => {
    expect(screen.getByText(/AI Team/i)).toBeInTheDocument()
  })
}

const sendTeamInput = async (message: string, { waitForIdle = true }: { waitForIdle?: boolean } = {}) => {
  const input = screen.getByPlaceholderText(/输入你的需求/i)
  const sendButton = screen.getByRole('button', { name: /发送/i })

  await act(async () => {
    fireEvent.change(input, { target: { value: message } })
    fireEvent.click(sendButton)
  })

  if (waitForIdle) {
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /发送/i })).not.toBeDisabled()
    })
  }

  return { input, sendButton }
}

const sendTeamInputAndWait = async (message: string) => sendTeamInput(message)

const reactTestWarningPattern = /Encountered two children with the same key|same key|not wrapped in act\(\.\.\.\)/i

const expectNoReactTestWarnings = (consoleErrorSpy: jest.SpyInstance) => {
  expect(consoleErrorSpy.mock.calls.flat().join(' ')).not.toMatch(reactTestWarningPattern)
}

describe('Team Chat Page (/team)', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValue({
      json: async () => ({ success: true, message: 'Test response' })
    })
  })

  afterEach(() => {
    expectNoReactTestWarnings(consoleErrorSpy)
    consoleErrorSpy.mockRestore()
  })

  describe('渲染测试', () => {
    it('应该渲染页面标题', async () => {
      await renderTeamPage()
      expect(screen.getByText(/AI Team/i)).toBeInTheDocument()
    })

    it('应该显示三个 Agent', async () => {
      await renderTeamPage()
      expect(screen.getByText('产品经理')).toBeInTheDocument()
      expect(screen.getByText('开发者')).toBeInTheDocument()
      expect(screen.getByText('审查员')).toBeInTheDocument()
    })

    it('应该显示输入框', async () => {
      await renderTeamPage()
      expect(screen.getByPlaceholderText(/输入你的需求/i)).toBeInTheDocument()
    })

    it('应该显示发送按钮', async () => {
      await renderTeamPage()
      expect(screen.getByRole('button', { name: /发送/i })).toBeInTheDocument()
    })

    it('应该显示返回首页链接', async () => {
      await renderTeamPage()
      expect(screen.getByRole('link', { name: /返回首页/i })).toBeInTheDocument()
    })
  })

  describe('交互测试', () => {
    it('输入框应该可以输入文字', async () => {
      await renderTeamPage()
      const input = screen.getByPlaceholderText(/输入你的需求/i)

      fireEvent.change(input, { target: { value: '测试消息' } })

      expect(input).toHaveValue('测试消息')
    })

    it('空消息不应该触发发送', async () => {
      await renderTeamPage()
      const sendButton = screen.getByRole('button', { name: /发送/i })

      fireEvent.click(sendButton)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('GLM模式发送消息应该调用 /api/chat（聚合工作流）', async () => {
      await renderTeamPage()
      await sendTeamInputAndWait('创建登录页面')

      expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '创建登录页面' })
      }))
    })

    it('OpenClaw模式发送消息应该调用 /api/openclaw', async () => {
      await renderTeamPage()

      fireEvent.click(screen.getByRole('button', { name: /OpenClaw/i }))
      await sendTeamInputAndWait('创建登录页面')

      expect(mockFetch).toHaveBeenCalledWith('/api/openclaw', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'orchestrate', userRequest: '创建登录页面' })
      }))
    })

    it('OpenClaw 请求成功后应该显示已连接状态', async () => {
      await renderTeamPage()

      fireEvent.click(screen.getByRole('button', { name: /OpenClaw/i }))
      await sendTeamInputAndWait('创建登录页面')

      await waitFor(() => {
        expect(screen.getByText(/OpenClaw: 已连接/i)).toBeInTheDocument()
      })
    })

    it('切换模式后应该显示对应的API信息', async () => {
      await renderTeamPage()

      expect(screen.getByText(/GLM.*直接调用/)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /OpenClaw/i }))

      expect(screen.getByText(/OpenClaw.*集成/)).toBeInTheDocument()
    })

    it('发送后应该清空输入框', async () => {
      await renderTeamPage()
      const { input } = await sendTeamInputAndWait('测试')

      expect(input).toHaveValue('')
    })

    it('加载中应该禁用发送按钮', async () => {
      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      await renderTeamPage()
      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })

      fireEvent.change(input, { target: { value: '测试' } })
      fireEvent.click(sendButton)

      expect(sendButton).toBeDisabled()
    })

    it('按 Enter 键应该发送消息', async () => {
      await renderTeamPage()
      const input = screen.getByPlaceholderText(/输入你的需求/i)

      await act(async () => {
        fireEvent.change(input, { target: { value: '测试' } })
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 })
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
          method: 'POST'
        }))
      })
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /发送/i })).not.toBeDisabled()
      })

      expectNoReactTestWarnings(consoleErrorSpy)
    })

    it('应该显示当前使用的模式（GLM或OpenClaw）', async () => {
      await renderTeamPage()
      expect(screen.getByText(/当前模式:.*GLM.*直接调用/)).toBeInTheDocument()
    })
  })

  describe('消息显示测试', () => {
    it('发送消息后应该显示用户消息', async () => {
      await renderTeamPage()
      await sendTeamInputAndWait('创建登录页面')

      expect(screen.getByText('创建登录页面')).toBeInTheDocument()
    })

    it('应该显示正在处理的消息', async () => {
      mockFetch.mockImplementationOnce(() => new Promise(() => {}))

      await renderTeamPage()

      const input = screen.getByPlaceholderText(/输入你的需求/i)
      const sendButton = screen.getByRole('button', { name: /发送/i })
      fireEvent.change(input, { target: { value: '测试消息' } })
      fireEvent.click(sendButton)

      expect(screen.getByText(/正在通过 GLM/i)).toBeInTheDocument()
    })

    it('同一毫秒追加多条消息也不应该产生重复 key warning', async () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1713920000000)
      mockFetch.mockResolvedValue({
        json: async () => ({
          success: true,
          phases: {
            pm: { message: 'PM 分析完成' },
            dev: { message: '开发完成' },
            review: { message: '审查完成' }
          }
        })
      })

      await renderTeamPage()
      await sendTeamInputAndWait('创建登录页面')

      await waitFor(() => {
        expect(screen.getByText(/团队协作完成/i)).toBeInTheDocument()
      })

      expectNoReactTestWarnings(consoleErrorSpy)

      nowSpy.mockRestore()
    })

    it('API 返回后完成所有异步状态更新时不应该出现 act warning', async () => {
      await renderTeamPage()
      await sendTeamInputAndWait('创建登录页面')

      await waitFor(() => {
        expect(screen.getByText(/团队协作完成/i)).toBeInTheDocument()
      })

      expectNoReactTestWarnings(consoleErrorSpy)
    })
  })

  describe('错误处理测试', () => {
    it('API 错误应该显示错误消息', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await renderTeamPage()
      await sendTeamInput('测试消息')

      expect(screen.getByText(/Network error/i)).toBeInTheDocument()
    })

    it('API 返回失败应该显示错误', async () => {
      mockFetch.mockResolvedValue({
        json: async () => ({ success: false, error: 'Invalid request' })
      })

      await renderTeamPage()
      await sendTeamInput('测试消息')

      expect(screen.getByText(/Invalid request/i)).toBeInTheDocument()
    })
  })

  describe('可访问性测试', () => {
    it('输入框应该有正确的 aria-label', async () => {
      await renderTeamPage()
      expect(screen.getByPlaceholderText(/输入你的需求/i)).toHaveAttribute('aria-label')
    })

    it('发送按钮应该有正确的 type', async () => {
      await renderTeamPage()
      expect(screen.getByRole('button', { name: /发送/i })).toHaveAttribute('type', 'button')
    })
  })
})
