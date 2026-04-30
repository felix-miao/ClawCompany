import { render, screen } from '@testing-library/react'

import OfficePage from '../page'

describe('OfficePage', () => {
  it('renders a visible office surface with agent cards', () => {
    const { container } = render(<OfficePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Office' })).toBeInTheDocument()
    expect(screen.getAllByText(/snapshot fallback/i).length).toBeGreaterThan(0)
    expect(container.querySelector('[data-testid="office-surface"]')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeInTheDocument()
    expect(screen.getByTestId('agent-card-pm-agent')).toBeInTheDocument()
    expect(screen.getByTestId('agent-card-dev-agent')).toBeInTheDocument()
  })
})
