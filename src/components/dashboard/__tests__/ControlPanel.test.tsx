import { render, screen } from '@testing-library/react';

import { ControlPanel } from '../ControlPanel';

describe('ControlPanel', () => {
  it('should render control panel title', () => {
    render(<ControlPanel />);

    expect(screen.getByText('Control Panel')).toBeInTheDocument();
  });

  it('should render quick task buttons', () => {
    render(<ControlPanel />);

    expect(screen.getByText('快速触发任务')).toBeInTheDocument();
    expect(screen.getByText('Blog website (Next.js + Tailwind)')).toBeInTheDocument();
    expect(screen.getByText('Unit tests for login module')).toBeInTheDocument();
    expect(screen.getByText('Review client.ts code quality')).toBeInTheDocument();
    expect(screen.getByText('Implement /api/health endpoint')).toBeInTheDocument();
    expect(screen.getByText('随机任务')).toBeInTheDocument();
  });

  it('should not render manual demo controls', () => {
    render(<ControlPanel />);

    expect(screen.queryByText('手动控制 Agent')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agent')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Emotion')).not.toBeInTheDocument();
    expect(screen.queryByText('Set Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    expect(screen.queryByText('Emotion')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Task description...')).not.toBeInTheDocument();
  });
});
