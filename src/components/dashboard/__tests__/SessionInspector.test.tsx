import { render, screen } from '@testing-library/react';

import { SessionInspector } from '../SessionInspector';

import type { OpenClawSessionDetails } from '@/lib/gateway/openclaw-snapshot';

function createSession(overrides: Partial<OpenClawSessionDetails> = {}): OpenClawSessionDetails {
  return {
    sessionKey: 'sess-1',
    agentId: 'dev-claw',
    agentName: 'Dev Claw',
    role: 'dev',
    label: 'Test session label',
    status: 'running',
    startedAt: '2026-04-14T05:00:00Z',
    endedAt: null,
    currentWork: 'Working on something',
    latestThought: 'Thinking about stuff',
    latestResultSummary: 'Result summary',
    model: 'gpt-5.4',
    latestMessage: 'This is the latest assistant message',
    latestMessageRole: 'assistant',
    latestMessageStatus: 'completed',
    history: [
      { role: 'user', content: 'User request 1', timestamp: '2026-04-14T05:00:00Z' },
      { role: 'assistant', content: 'Assistant response 1', timestamp: '2026-04-14T05:01:00Z' },
      { role: 'toolResult', content: 'Tool result 1', timestamp: '2026-04-14T05:02:00Z' },
      { role: 'assistant', content: 'Assistant response 2', timestamp: '2026-04-14T05:03:00Z' },
    ],
    artifacts: [],
    category: 'running',
    ...overrides,
  };
}

describe('SessionInspector', () => {
  it('renders nothing when session is null', () => {
    const { container } = render(<SessionInspector session={null} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders session header with agent name', () => {
    render(<SessionInspector session={createSession({ agentName: 'PM Claw' })} onClose={jest.fn()} />);
    expect(screen.getByText('PM Claw')).toBeInTheDocument();
    expect(screen.getByText('Session Inspector')).toBeInTheDocument();
  });

  it('renders session label', () => {
    render(<SessionInspector session={createSession({ label: 'My Task' })} onClose={jest.fn()} />);
    expect(screen.getByText('My Task')).toBeInTheDocument();
  });

  it('renders latest assistant message', () => {
    render(
      <SessionInspector
        session={createSession({ latestMessage: 'This is the final output from the assistant' })}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText(/final output from the assistant/)).toBeInTheDocument();
  });

  it('renders recent history messages', () => {
    const session = createSession({
      history: [
        { role: 'user', content: 'First user message', timestamp: '2026-04-14T05:00:00Z' },
        { role: 'assistant', content: 'First assistant reply', timestamp: '2026-04-14T05:01:00Z' },
        { role: 'toolResult', content: 'Tool execution result', timestamp: '2026-04-14T05:02:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText(/First user message/)).toBeInTheDocument();
    expect(screen.getByText(/First assistant reply/)).toBeInTheDocument();
    expect(screen.getAllByText(/Tool execution result/).length).toBeGreaterThan(0);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<SessionInspector session={createSession()} onClose={onClose} />);
    screen.getByText('×').click();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows recent history count', () => {
    const session = createSession({
      history: [
        { role: 'user', content: 'Msg 1', timestamp: '2026-04-14T05:00:00Z' },
        { role: 'assistant', content: 'Msg 2', timestamp: '2026-04-14T05:01:00Z' },
        { role: 'toolResult', content: 'Msg 3', timestamp: '2026-04-14T05:02:00Z' },
        { role: 'assistant', content: 'Msg 4', timestamp: '2026-04-14T05:03:00Z' },
        { role: 'user', content: 'Msg 5', timestamp: '2026-04-14T05:04:00Z' },
        { role: 'assistant', content: 'Msg 6', timestamp: '2026-04-14T05:05:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText(/Recent History \(6 messages\)/)).toBeInTheDocument();
  });

  it('displays last tool result when available', () => {
    const session = createSession({
      history: [
        { role: 'user', content: 'User request 1', timestamp: '2026-04-14T05:00:00Z' },
        { role: 'assistant', content: 'Assistant response 1', timestamp: '2026-04-14T05:01:00Z' },
        { role: 'toolResult', content: 'Tool result for test.ts', timestamp: '2026-04-14T05:02:00Z' },
        { role: 'assistant', content: 'Assistant response 2', timestamp: '2026-04-14T05:03:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('Last Tool Result')).toBeInTheDocument();
  });

  it('displays last file info when available', () => {
    const session = createSession({
      history: [
        { role: 'user', content: 'User request 1', timestamp: '2026-04-14T05:00:00Z' },
        { role: 'assistant', content: 'Writing file', timestamp: '2026-04-14T05:01:00Z' },
        { role: 'toolResult', content: '已写入文件: /src/app/test.ts', timestamp: '2026-04-14T05:02:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('Last File')).toBeInTheDocument();
  });

  it('displays raw session state when requested', () => {
    const session = createSession({
      label: 'Debug Task',
      status: 'running',
      history: [
        { role: 'user', content: 'User message', timestamp: '2026-04-14T05:00:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('Raw State')).toBeInTheDocument();
  });

  it('shows raw state as expandable section', () => {
    const session = createSession({
      label: 'Expandable Test',
      status: 'running',
      history: [],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    const rawStateButton = screen.getByText('Raw State');
    expect(rawStateButton).toBeInTheDocument();
  });
});