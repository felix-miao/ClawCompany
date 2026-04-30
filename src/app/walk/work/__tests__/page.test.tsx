import { render, screen } from '@testing-library/react'

import WalkWorkPage from '../page'

describe('WalkWorkPage', () => {
  it('renders the core work workspace route', () => {
    render(<WalkWorkPage />)

    expect(screen.getByRole('heading', { name: /Work Workspace/i })).toBeInTheDocument()
    expect(screen.getAllByText(/OpenClaw snapshot/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('walk-workspace')).toBeInTheDocument()
  })
})
