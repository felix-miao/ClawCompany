import { render, screen } from '@testing-library/react'
import Home from '../page'

describe('Landing Page', () => {
  it('应该显示主标题', () => {
    render(<Home />)
    
    expect(screen.getByText(/One Person/i)).toBeInTheDocument()
    expect(screen.getByText(/Infinite Power/i)).toBeInTheDocument()
  })

  it('应该显示 CTA 按钮', () => {
    render(<Home />)
    
    expect(screen.getByRole('link', { name: /Start Chatting/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View Demo/i })).toBeInTheDocument()
  })

  it('应该显示三个 Agent 卡片', () => {
    render(<Home />)
    
    expect(screen.getByText('PM Claw')).toBeInTheDocument()
    expect(screen.getByText('Dev Claw')).toBeInTheDocument()
    expect(screen.getByText('Reviewer Claw')).toBeInTheDocument()
  })

  it('应该显示 Agent 角色描述', () => {
    render(<Home />)
    
    expect(screen.getByText('Product Manager')).toBeInTheDocument()
    expect(screen.getByText('Developer')).toBeInTheDocument()
    expect(screen.getByText('Code Reviewer')).toBeInTheDocument()
  })

  it('CTA 按钮应该链接到 /team', () => {
    render(<Home />)
    
    const chatLink = screen.getByRole('link', { name: /Start Chatting/i })
    expect(chatLink).toHaveAttribute('href', '/team')
  })
})
