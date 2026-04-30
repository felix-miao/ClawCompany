import { fireEvent, render, screen } from '@testing-library/react';

import { ControlPanel } from '../ControlPanel';

describe('ControlPanel', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  it('should render control panel title', () => {
    render(<ControlPanel />);

    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should render quick task controls', () => {
    render(<ControlPanel />);

    expect(screen.getByText('任务控制')).toBeInTheDocument();
    expect(screen.getByText('Blog website (Next.js + Tailwind)')).toBeInTheDocument();
    expect(screen.getByText('刷新 OpenClaw Snapshot')).toBeInTheDocument();
    expect(screen.getByText(/Dashboard 仅展示 OpenClaw snapshot/)).toBeInTheDocument();
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

  it('should disable preset task buttons instead of posting to /api/chat', () => {
    const onTriggerTask = jest.fn();

    render(<ControlPanel onTriggerTask={onTriggerTask} />);

    fireEvent.click(screen.getByText('Blog website (Next.js + Tailwind)'));

    expect(screen.getByText('Blog website (Next.js + Tailwind)')).toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onTriggerTask).not.toHaveBeenCalled();
  });

  it('should refresh snapshot on explicit refresh', () => {
    const onTriggerTask = jest.fn();

    render(<ControlPanel onTriggerTask={onTriggerTask} />);

    fireEvent.click(screen.getByText('刷新 OpenClaw Snapshot'));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(onTriggerTask).toHaveBeenCalledWith('snapshot-refresh');
  });
});
