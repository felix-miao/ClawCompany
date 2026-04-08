import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'

import DemoPage from '../demo/page'

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: ReactNode }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: { children?: ReactNode }) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: { children?: ReactNode }) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

describe('Demo Page', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('应该显示页面标题', () => {
    render(<DemoPage />)
    
    expect(screen.getByText('AI Team Demo')).toBeInTheDocument()
  })

  it('应该显示返回链接', () => {
    render(<DemoPage />)
    
    expect(screen.getByRole('link', { name: /Back/i })).toBeInTheDocument()
  })

  it('应该显示 Team Chat 标题', () => {
    render(<DemoPage />)
    
    expect(screen.getByText('Team Chat')).toBeInTheDocument()
  })

  it('应该显示重启按钮', () => {
    render(<DemoPage />)
    
    expect(screen.getByRole('button', { name: /Restart Demo/i })).toBeInTheDocument()
  })

  it('应该显示三个 Agent 状态卡片', () => {
    render(<DemoPage />)
    
    expect(screen.getByText('PM Claw')).toBeInTheDocument()
    expect(screen.getByText('Dev Claw')).toBeInTheDocument()
    expect(screen.getByText('Reviewer Claw')).toBeInTheDocument()
  })

  it('应该显示 Agent 状态', () => {
    render(<DemoPage />)
    
    expect(screen.getByText('Analyzing')).toBeInTheDocument()
    expect(screen.getByText('Building')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
  })

  it('返回链接应该指向首页', () => {
    render(<DemoPage />)
    
    const backLink = screen.getByRole('link', { name: /Back/i })
    expect(backLink).toHaveAttribute('href', '/')
  })
})
