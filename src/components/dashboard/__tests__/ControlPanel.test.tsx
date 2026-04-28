import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ControlPanel } from '../ControlPanel';

const mockFetch = jest.fn();

function makeChatResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      success: true,
      taskId: 'task-unit-123',
      ...overrides,
    }),
  };
}

describe('ControlPanel', () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(makeChatResponse());
  });

  it('should render control panel title', () => {
    render(<ControlPanel />);

    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should render quick task controls', () => {
    render(<ControlPanel />);

    expect(screen.getByText('快速触发任务')).toBeInTheDocument();
    expect(screen.getByText('Blog website (Next.js + Tailwind)')).toBeInTheDocument();
    expect(screen.getByText('随机任务')).toBeInTheDocument();
  });

  it('should not render manual agent event controls', () => {
    render(<ControlPanel />);

    expect(screen.queryByLabelText('Agent')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Emotion')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    expect(screen.queryByText('Emotion')).not.toBeInTheDocument();
  });

  it('should submit a preset task through /api/chat', async () => {
    const onTriggerTask = jest.fn();

    render(<ControlPanel onTriggerTask={onTriggerTask} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: expect.stringContaining('Next.js'),
        }),
      );
      expect(onTriggerTask).toHaveBeenCalledWith('task-unit-123');
    });
  });

  it('should submit a random task through /api/chat', async () => {
    render(<ControlPanel onTriggerTask={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByText('随机任务'));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.any(Object));
    });
  });

  it('should show loading state while a task is being submitted', async () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<ControlPanel onTriggerTask={jest.fn()} />);

    act(() => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'));
    });

    await waitFor(() => {
      expect(screen.getAllByText('⏳ 触发中...').length).toBeGreaterThan(0);
      expect(screen.getByText('触发中...')).toBeInTheDocument();
    });
  });

  it('should show an error and skip callback when chat fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) });
    const onTriggerTask = jest.fn();

    render(<ControlPanel onTriggerTask={onTriggerTask} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'));
    });

    await waitFor(() => {
      expect(onTriggerTask).not.toHaveBeenCalled();
      expect(screen.getByText('触发失败，请重试')).toBeInTheDocument();
    });
  });
});
