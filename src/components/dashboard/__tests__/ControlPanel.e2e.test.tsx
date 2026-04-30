import { fireEvent, render, screen } from '@testing-library/react'

import { ControlPanel } from '../ControlPanel'

describe('ControlPanel degraded task controls', () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
  })

  it('禁用预设任务按钮，不再向 /api/chat 发送假触发请求', () => {
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    const btn = screen.getByText('Blog website (Next.js + Tailwind)')
    fireEvent.click(btn)

    expect(btn).toBeDisabled()
    expect(mockFetch).not.toHaveBeenCalled()
    expect(onTriggerTask).not.toHaveBeenCalled()
  })

  it('显示真实链路说明，避免误导用户任务已触发', () => {
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    expect(screen.getByText(/Dashboard 仅展示 OpenClaw snapshot/)).toBeInTheDocument()
    expect(screen.getByText(/任务创建入口暂未接入 OpenClaw/)).toBeInTheDocument()
  })

  it('点击刷新按钮只刷新 snapshot，不调用 /api/chat', () => {
    const onTriggerTask = jest.fn()

    render(<ControlPanel onTriggerTask={onTriggerTask} />)

    fireEvent.click(screen.getByText('刷新 OpenClaw Snapshot'))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(onTriggerTask).toHaveBeenCalledWith('snapshot-refresh')
  })
})
