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
  recentEvents: [],
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

  it('should display current phase description when task is in progress', () => {
    render(<TraditionalTaskView tasks={[buildTask()]} />);

    expect(screen.getByText('当前阶段说明')).toBeInTheDocument();
    expect(screen.getByText(/正在处理任务/i)).toBeInTheDocument();
  });

  it('should display recent events section', () => {
    const taskWithRecentEvents = buildTask({
      recentEvents: [
        { type: 'task:assigned', timestamp: 100, agentId: 'pm-agent' },
        { type: 'task:handover', timestamp: 200, fromAgentId: 'pm-agent', toAgentId: 'dev-agent', taskId: 'task-1', description: 'test' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWithRecentEvents]} />);

    expect(screen.getByText('最近事件')).toBeInTheDocument();
  });

  it('should display failure summary for failed tasks', () => {
    const failedTask = buildTask({
      status: 'failed',
      currentPhase: 'done',
      failureSummary: 'compilation error: undefined variable x',
      recentEvents: [
        { type: 'task:failed', timestamp: 300, agentId: 'dev-agent', taskId: 'task-1', error: 'compilation error: undefined variable x' },
      ],
    });
    render(<TraditionalTaskView tasks={[failedTask]} />);

    expect(screen.getByText('错误摘要')).toBeInTheDocument();
    expect(screen.getByText(/compilation error/i)).toBeInTheDocument();
  });

  it('should display readable event summaries instead of raw event types', () => {
    const taskWithEvents = buildTask({
      recentEvents: [
        { type: 'task:assigned', timestamp: 100, agentId: 'pm-agent', task: { id: 'task-1', description: 'Test task', taskType: 'feature' } },
        { type: 'task:handover', timestamp: 200, fromAgentId: 'pm-agent', toAgentId: 'dev-agent', taskId: 'task-1', description: 'Test task' },
        { type: 'task:progress', timestamp: 300, agentId: 'dev-agent', taskId: 'task-1', progress: 50, currentAction: 'implementing feature' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWithEvents]} />);

    expect(screen.getByText('分配')).toBeInTheDocument();
    expect(screen.getByText(/交接给/i)).toBeInTheDocument();
    expect(screen.getByText(/进行中/i)).toBeInTheDocument();
  });

  it('should display last update time and live status for in-progress tasks', () => {
    const taskWithTime = buildTask({
      updatedAt: Date.now(),
      currentPhase: 'developer',
    });
    render(<TraditionalTaskView tasks={[taskWithTime]} />);

    expect(screen.getByText('最后更新')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
  });

  it('should display waiting status when task is waiting on another agent', () => {
    const taskWaiting = buildTask({
      currentPhase: 'developer',
      status: 'in_progress',
      recentEvents: [
        { type: 'task:handover', timestamp: 100, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-1', description: 'Task' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWaiting]} />);

    expect(screen.getByText(/等待/i)).toBeInTheDocument();
    expect(screen.getByText(/等待 Reviewer 处理/i)).toBeInTheDocument();
  });

  it('should map agent IDs to readable names in handover events', () => {
    const taskWaitingReviewer = buildTask({
      currentPhase: 'developer',
      status: 'in_progress',
      recentEvents: [
        { type: 'task:handover', timestamp: 100, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-1', description: 'Task' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWaitingReviewer]} />);

    expect(screen.queryByText(/等待 review-agent 处理/i)).not.toBeInTheDocument();
    expect(screen.getByText(/等待 Reviewer 处理/i)).toBeInTheDocument();
  });
});
