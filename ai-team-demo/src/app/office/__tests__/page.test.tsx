import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import OfficePage from '../page'

// Mock the game module
jest.mock('@/game', () => ({
  Game: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
  startGame: jest.fn().mockReturnValue({
    destroy: jest.fn(),
  }),
}))

describe('OfficePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render the office page with correct title', () => {
    render(<OfficePage />)
    
    expect(screen.getByText('虚拟办公室 - Phaser 3')).toBeInTheDocument()
  })

  it('should render game instructions', () => {
    render(<OfficePage />)
    
    expect(screen.getByText(/WASD 或方向键移动/)).toBeInTheDocument()
    expect(screen.getByText(/D 键切换 debug 模式/)).toBeInTheDocument()
  })

  it('should render game container with correct id', () => {
    render(<OfficePage />)
    
    const container = document.getElementById('game-container')
    expect(container).toBeInTheDocument()
  })

  it('should have correct container dimensions', () => {
    render(<OfficePage />)
    
    const container = document.getElementById('game-container')
    expect(container).toHaveStyle({ width: '800px', height: '600px' })
  })

  it('should have correct container styling', () => {
    render(<OfficePage />)
    
    const container = document.getElementById('game-container')
    expect(container).toHaveClass('rounded-xl', 'overflow-hidden')
  })

  it('should render header with gradient text', () => {
    render(<OfficePage />)
    
    const title = screen.getByText('虚拟办公室 - Phaser 3')
    expect(title).toHaveClass('gradient-text')
  })
})