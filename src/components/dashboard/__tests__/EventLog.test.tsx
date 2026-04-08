import { render, screen } from '@testing-library/react';

import { EventLog } from '../EventLog';

import { GameEvent } from '@/game/types/GameEvents';

const mockEvents: GameEvent[] = [
  {
    type: 'agent:status-change',
    timestamp: 1700000000000,
    agentId: 'alice',
    status: 'working',
  },
  {
    type: 'agent:task-assigned',
    timestamp: 1700000001000,
    agentId: 'bob',
    taskId: 'task-1',
    taskType: 'develop',
    description: 'Build feature X',
  },
  {
    type: 'session:started',
    timestamp: 1700000002000,
    sessionKey: 'sess-1',
    role: 'pm',
    task: 'Plan sprint',
  },
];

describe('EventLog', () => {
  it('should render event log title', () => {
    render(<EventLog events={[]} />);

    expect(screen.getByText('Event Log')).toBeInTheDocument();
  });

  it('should display events', () => {
    render(<EventLog events={mockEvents} />);

    expect(screen.getByText(/alice.*working/i)).toBeInTheDocument();
    expect(screen.getByText(/Build feature X/)).toBeInTheDocument();
  });

  it('should display event types', () => {
    render(<EventLog events={mockEvents} />);

    expect(screen.getByText('agent:status-change')).toBeInTheDocument();
    expect(screen.getByText('agent:task-assigned')).toBeInTheDocument();
    expect(screen.getByText('session:started')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    render(<EventLog events={[]} />);

    expect(screen.getByText(/No events yet/)).toBeInTheDocument();
  });

  it('should limit displayed events', () => {
    const manyEvents: GameEvent[] = Array.from({ length: 200 }, (_, i) => ({
      type: 'agent:status-change' as const,
      timestamp: 1700000000000 + i * 1000,
      agentId: 'alice',
      status: 'working' as const,
    }));

    render(<EventLog events={manyEvents} maxDisplay={50} />);

    const eventItems = screen.getAllByTestId('event-log-item');
    expect(eventItems.length).toBeLessThanOrEqual(50);
  });

  it('should display timestamps', () => {
    render(<EventLog events={mockEvents} />);

    const times = screen.getAllByText(/\d{1,2}:\d{2}/);
    expect(times.length).toBeGreaterThan(0);
  });
});
