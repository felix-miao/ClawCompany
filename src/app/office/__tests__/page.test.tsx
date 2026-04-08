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
    
    expect(screen.getByText('🎮 操作指南')).toBeInTheDocument()
    expect(screen.getByText('移动')).toBeInTheDocument()
    expect(screen.getByText('调试')).toBeInTheDocument()
    expect(screen.getByText('任务')).toBeInTheDocument()
    expect(screen.getByText('快速移动')).toBeInTheDocument()
  })

  it('should render game container with correct id', () => {
    render(<OfficePage />)
    
    const container = document.getElementById('game-container')
    expect(container).toBeInTheDocument()
  })

  it('should have correct container responsive styling', () => {
    render(<OfficePage />)
    
    const container = document.getElementById('game-container')
    expect(container).toHaveClass('w-full', 'h-full')
    
    // The styling is applied to the parent container, not the game-container itself
    const parentContainer = container?.parentElement
    if (parentContainer) {
      const computedStyle = window.getComputedStyle(parentContainer)
      expect(computedStyle.aspectRatio).toBe('4/3')
      expect(computedStyle.maxWidth).toBe('800px')
      // maxHeight removed for better responsive design
      expect(computedStyle.margin).toBe('0px auto')
    }
  })

  it('should have correct container styling', () => {
    render(<OfficePage />)
    
    const container = document.getElementById('game-container')
    expect(container).toHaveClass('w-full', 'h-full')
    
    // The rounded-xl and overflow-hidden classes are now on the parent container
    const parentContainer = container?.parentElement
    expect(parentContainer).toHaveClass('rounded-xl', 'overflow-hidden')
  })

  it('should render header with gradient text', () => {
    render(<OfficePage />)
    
    const title = screen.getByText('虚拟办公室 - Phaser 3')
    expect(title).toHaveClass('gradient-text')
  })
})