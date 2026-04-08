import { render, screen } from '@testing-library/react';

import { AgentStatusPanel } from '../AgentStatusPanel';

import { AgentInfo } from '@/game/data/DashboardStore';

const mockAgents: AgentInfo[] = [
  { id: 'alice', name: 'Alice', role: 'Developer', status: 'idle', emotion: 'neutral', currentTask: null },
  { id: 'bob', name: 'Bob', role: 'Developer', status: 'working', emotion: 'focused', currentTask: 'Build API' },
  { id: 'charlie', name: 'Charlie', role: 'PM', status: 'busy', emotion: 'thinking', currentTask: null },
  { id: 'diana', name: 'Diana', role: 'Reviewer', status: 'offline', emotion: 'neutral', currentTask: null },
];

describe('AgentStatusPanel', () => {
  it('should render all agents', () => {
    render(<AgentStatusPanel agents={mockAgents} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('should display agent roles', () => {
    render(<AgentStatusPanel agents={mockAgents} />);

    expect(screen.getAllByText('Developer')).toHaveLength(2);
    expect(screen.getByText('PM')).toBeInTheDocument();
    expect(screen.getByText('Reviewer')).toBeInTheDocument();
  });

  it('should display status badges', () => {
    render(<AgentStatusPanel agents={mockAgents} />);

    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(screen.getByText('working')).toBeInTheDocument();
    expect(screen.getByText('busy')).toBeInTheDocument();
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('should display current task when agent is working', () => {
    render(<AgentStatusPanel agents={mockAgents} />);

    expect(screen.getByText('Build API')).toBeInTheDocument();
  });

  it('should display emotion indicators', () => {
    render(<AgentStatusPanel agents={mockAgents} />);

    expect(screen.getByText(/focused/)).toBeInTheDocument();
    expect(screen.getByText(/thinking/)).toBeInTheDocument();
  });

  it('should render panel title', () => {
    render(<AgentStatusPanel agents={mockAgents} />);

    expect(screen.getByText('Agent Status')).toBeInTheDocument();
  });

  it('should handle empty agents list', () => {
    render(<AgentStatusPanel agents={[]} />);

    expect(screen.getByText('Agent Status')).toBeInTheDocument();
  });

  it('should apply correct status colors', () => {
    const { container } = render(<AgentStatusPanel agents={mockAgents} />);

    const statusBadges = container.querySelectorAll('[data-status]');
    expect(statusBadges.length).toBeGreaterThan(0);
  });
});
