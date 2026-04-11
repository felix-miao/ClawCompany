import { fireEvent, render, screen } from '@testing-library/react';

import { TraditionalTaskView } from '../TraditionalTaskView';

import { TaskHistory } from '@/game/data/DashboardStore';

const buildTask = (overrides: Partial<TaskHistory> = {}): TaskHistory => ({
  taskId: 'task-1',
  description: '实现传统任务视图',
  currentPhase: 'developer',
  currentAgentId: 'dev-agent',
  currentAgentName: 'Dev Claw',
  createdAt: 100,
  updatedAt: 300,
  status: 'in_progress',
  phases: [
    { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: 100, endTime: 100, status: 'completed' },
    { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 120, endTime: 180, status: 'completed' },
    { phase: 'planning', label: 'Planning', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 180, endTime: 200, status: 'completed' },
    { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev Claw', startTime: 200, status: 'in_progress' },
    { phase: 'tester', label: 'Tester', agentId: 'test-agent', agentName: 'Tester Claw', status: 'pending' },
    { phase: 'reviewer', label: 'Reviewer', agentId: 'review-agent', agentName: 'Reviewer Claw', status: 'pending' },
    { phase: 'done', label: 'Done', agentId: null, agentName: null, status: 'pending' },
  ],
  ...overrides,
});

describe('TraditionalTaskView', () => {
  it('should render empty state', () => {
    render(<TraditionalTaskView tasks={[]} />);

    expect(screen.getByText('Traditional Task Tracker')).toBeInTheDocument();
    expect(screen.getByText('Waiting for task lifecycle events...')).toBeInTheDocument();
  });

  it('should show selected task blocker and timeline details', () => {
    render(<TraditionalTaskView tasks={[buildTask()]} />);

    expect(screen.getAllByText('实现传统任务视图')[0]).toBeInTheDocument();
    expect(screen.getByText('当前卡点')).toBeInTheDocument();
    expect(screen.getByText('Developer · Dev Claw')).toBeInTheDocument();
    expect(screen.getByText('PM Analysis')).toBeInTheDocument();
    expect(screen.getAllByText('Developer')[0]).toBeInTheDocument();
  });

  it('should switch selected task from task list', () => {
    render(
      <TraditionalTaskView
        tasks={[
          buildTask(),
          buildTask({
            taskId: 'task-2',
            description: '补失败态展示',
            currentPhase: 'reviewer',
            currentAgentId: 'review-agent',
            currentAgentName: 'Reviewer Claw',
            updatedAt: 500,
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /补失败态展示/i }));

    expect(screen.getByText('Selected Task')).toBeInTheDocument();
    expect(screen.getAllByText('补失败态展示')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Reviewer')[0]).toBeInTheDocument();
  });
});
