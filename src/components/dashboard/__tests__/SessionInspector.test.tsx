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
    finalDeliveryArtifacts: [],
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

  it('prioritizes structured finalResultSummary over plain text history', () => {
    const session = createSession({
      finalResultSummary: {
        toolType: 'write',
        operation: 'write',
        paths: ['/src/components/NewFile.tsx'],
        urls: [],
        status: 'completed',
        summaryText: 'Created new component file',
      },
      history: [
        { role: 'user', content: 'Create a file', timestamp: '2026-04-14T05:00:00Z' },
        { role: 'assistant', content: 'Writing file', timestamp: '2026-04-14T05:01:00Z' },
        { role: 'toolResult', content: 'Some tool result text', timestamp: '2026-04-14T05:02:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('/src/components/NewFile.tsx')).toBeInTheDocument();
  });

  it('displays final result summary when structured metadata exists', () => {
    const session = createSession({
      finalResultSummary: {
        toolType: 'test',
        operation: 'test',
        paths: ['/src/app.test.ts'],
        urls: [],
        status: 'completed',
        summaryText: 'All tests passed',
      },
      history: [
        { role: 'toolResult', content: 'Test output', timestamp: '2026-04-14T05:02:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('Last Tool Result')).toBeInTheDocument();
  });

  it('prioritizes structured final result summary over assistant history noise', () => {
    const session = createSession({
      finalResultSummary: {
        toolType: 'write',
        operation: 'write',
        paths: ['/src/app/index.html'],
        urls: [],
        status: 'completed',
        summaryText: 'Delivered final homepage',
      },
      latestResultSummary: 'Delivered final homepage',
      latestMessage: 'Intermediate tool chatter',
      history: [
        { role: 'assistant', content: 'Thinking...', timestamp: '2026-04-14T05:01:00Z' },
        { role: 'toolResult', content: 'Intermediate tool chatter', timestamp: '2026-04-14T05:02:00Z' },
      ],
    });

    render(<SessionInspector session={session} onClose={jest.fn()} />);

    expect(screen.getByText('Delivered final homepage')).toBeInTheDocument();
    expect(screen.getByText('/src/app/index.html')).toBeInTheDocument();
    expect(screen.getByText('Last Assistant Output')).toBeInTheDocument();
  });

  it('uses finalDeliveryArtifacts to supply missing file details when finalResultSummary is present', () => {
    const session = createSession({
      finalResultSummary: {
        toolType: 'deploy',
        operation: 'deploy',
        paths: [],
        urls: [],
        status: 'completed',
        summaryText: 'Deployment completed',
      },
      finalDeliveryArtifacts: [
        {
          type: 'html',
          path: '/src/app/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:10:00Z',
          isFinal: true,
        },
        {
          type: 'url',
          url: 'https://example.com/app',
          title: 'example.com/app',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:11:00Z',
          isFinal: true,
        },
      ],
      history: [
        { role: 'toolResult', content: 'Deployment completed', timestamp: '2026-04-14T05:12:00Z' },
      ],
    });

    render(<SessionInspector session={session} onClose={jest.fn()} />);

    expect(screen.getAllByText('Deployment completed')).toHaveLength(2);
    expect(screen.getByText('/src/app/index.html')).toBeInTheDocument();
    expect(screen.getAllByText('https://example.com/app')).toHaveLength(2);
  });

  it('displays artifacts from structured metadata', () => {
    const session = createSession({
      artifacts: [
        {
          type: 'tsx',
          path: '/src/components/Demo.tsx',
          title: 'Demo.tsx',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:02:00Z',
        },
        {
          type: 'url',
          url: 'https://example.com/deployed',
          title: 'Deployed Site',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:03:00Z',
        },
      ],
      history: [],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('/src/components/Demo.tsx')).toBeInTheDocument();
  });

  it('shows final delivery artifacts even when structured summary has no paths or urls', () => {
    const session = createSession({
      finalResultSummary: {
        toolType: 'deploy',
        operation: 'deploy',
        paths: [],
        urls: [],
        status: 'completed',
        summaryText: 'Deployment completed',
      },
      finalDeliveryArtifacts: [
        {
          type: 'html',
          path: '/src/app/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:10:00Z',
          isFinal: true,
        },
        {
          type: 'url',
          url: 'https://example.com/deployed',
          title: 'Deployed Site',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:11:00Z',
          isFinal: true,
        },
      ],
      history: [],
    });

    render(<SessionInspector session={session} onClose={jest.fn()} />);

    expect(screen.getByText('/src/app/index.html')).toBeInTheDocument();
    expect(screen.getAllByText('https://example.com/deployed')).toHaveLength(2);
  });

  it('shows final delivery artifacts ahead of intermediate artifacts', () => {
    const session = createSession({
      artifacts: [
        {
          type: 'code',
          path: '/src/components/Draft.tsx',
          title: 'Draft.tsx',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:01:00Z',
        },
      ],
      finalDeliveryArtifacts: [
        {
          type: 'html',
          path: '/src/app/index.html',
          url: 'file:///src/app/index.html',
          title: 'index.html',
          producedBy: 'dev-claw',
          producedAt: '2026-04-14T05:10:00Z',
        },
      ],
      history: [],
    });

    render(<SessionInspector session={session} onClose={jest.fn()} />);

    expect(screen.getAllByText('/src/app/index.html')).toHaveLength(2);
    expect(screen.queryByText('/src/components/Draft.tsx')).not.toBeInTheDocument();
  });

  it('falls back to latestResultSummary when no structured result or tool result exists', () => {
    const session = createSession({
      finalResultSummary: null,
      latestResultSummary: 'Snapshot says final output is ready',
      history: [],
      latestMessage: null,
      artifacts: [],
      finalDeliveryArtifacts: [],
    });

    render(<SessionInspector session={session} onClose={jest.fn()} />);

    expect(screen.getByText('Last Tool Result')).toBeInTheDocument();
    expect(screen.getByText(/Snapshot says final output is ready/)).toBeInTheDocument();
  });

  it('falls back to regex extraction when no structured metadata exists', () => {
    const session = createSession({
      artifacts: [],
      finalResultSummary: null,
      history: [
        { role: 'user', content: 'Create a file', timestamp: '2026-04-14T05:00:00Z' },
        { role: 'toolResult', content: '已写入文件: /src/app/new.ts', timestamp: '2026-04-14T05:01:00Z' },
      ],
    });
    render(<SessionInspector session={session} onClose={jest.fn()} />);
    expect(screen.getByText('/src/app/new.ts')).toBeInTheDocument();
  });
});
