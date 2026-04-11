import { fireEvent, render, screen } from '@testing-library/react';

import { TraditionalTaskView } from '../TraditionalTaskView';

import { TaskHistory } from '@/game/data/DashboardStore';

const buildTask = (overrides: Partial<TaskHistory> = {}): TaskHistory => ({
  taskId: 'task-1',
  description: '实现传统任务视图',
  currentPhase: 'developer',
  currentAgentId: 'dev-agent',
  currentAgentName: 'Dev Claw',
  createdAt: Date.now() - 60000,
  updatedAt: Date.now(),
  status: 'in_progress',
  phases: [
    { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: Date.now() - 60000, endTime: Date.now() - 55000, status: 'completed' },
    { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'pm-agent', agentName: 'PM Claw', startTime: Date.now() - 50000, endTime: Date.now() - 40000, status: 'completed' },
    { phase: 'planning', label: 'Planning', agentId: 'pm-agent', agentName: 'PM Claw', startTime: Date.now() - 40000, endTime: Date.now() - 30000, status: 'completed' },
    { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev Claw', startTime: Date.now() - 30000, status: 'in_progress' },
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

  it('should show stagnation indicator when task has not been updated for a long time', () => {
    const staleTask = buildTask({
      currentPhase: 'developer',
      status: 'in_progress',
      updatedAt: Date.now() - 5 * 60 * 1000,
      recentEvents: [
        { type: 'task:handover', timestamp: 100, fromAgentId: 'pm-agent', toAgentId: 'dev-agent', taskId: 'task-1', description: 'Task' },
      ],
    });
    render(<TraditionalTaskView tasks={[staleTask]} />);

    expect(screen.getByText(/停滞/i)).toBeInTheDocument();
  });

  it('should show active status when task was recently updated', () => {
    const activeTask = buildTask({
      currentPhase: 'developer',
      status: 'in_progress',
      updatedAt: Date.now() - 30 * 1000,
      recentEvents: [],
    });
    render(<TraditionalTaskView tasks={[activeTask]} />);

    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.queryByText(/停滞/i)).not.toBeInTheDocument();
  });

  it('should highlight failed phase with distinct styling', () => {
    const failedTask = buildTask({
      status: 'failed',
      currentPhase: 'tester',
      failureSummary: 'test suite failed',
      phases: [
        { phase: 'submitted', label: 'Submitted', agentId: 'user', agentName: 'User', startTime: 100, endTime: 100, status: 'completed' },
        { phase: 'pm_analysis', label: 'PM Analysis', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 120, endTime: 150, status: 'completed' },
        { phase: 'planning', label: 'Planning', agentId: 'pm-agent', agentName: 'PM Claw', startTime: 150, endTime: 180, status: 'completed' },
        { phase: 'developer', label: 'Developer', agentId: 'dev-agent', agentName: 'Dev Claw', startTime: 180, endTime: 250, status: 'completed' },
        { phase: 'tester', label: 'Tester', agentId: 'test-agent', agentName: 'Tester Claw', startTime: 250, endTime: 300, status: 'failed' },
        { phase: 'reviewer', label: 'Reviewer', agentId: 'review-agent', agentName: 'Reviewer Claw', status: 'pending' },
        { phase: 'done', label: 'Done', agentId: null, agentName: null, status: 'pending' },
      ],
    });
    render(<TraditionalTaskView tasks={[failedTask]} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('test suite failed')).toBeInTheDocument();
  });

  it('should show enhanced blocker message with wait duration', () => {
    const now = Date.now();
    const taskWaiting = buildTask({
      currentPhase: 'reviewer',
      status: 'in_progress',
      updatedAt: now,
      recentEvents: [
        { type: 'task:handover', timestamp: now - 3 * 60 * 1000, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-1', description: 'Task' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWaiting]} />);

    expect(screen.getByText(/等待/i)).toBeInTheDocument();
    expect(screen.getByText(/3分钟/i)).toBeInTheDocument();
  });

  it('should show last progress info in blocker message', () => {
    const taskWithProgress = buildTask({
      currentPhase: 'developer',
      status: 'in_progress',
      recentEvents: [
        { type: 'task:progress', timestamp: Date.now() - 2 * 60 * 1000, agentId: 'dev-agent', taskId: 'task-1', progress: 60, currentAction: 'implementing feature X' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWithProgress]} />);

    expect(screen.getByText(/最近进展.*implementing feature X/i)).toBeInTheDocument();
  });

  it('should display iteration count and rework indicator', () => {
    const taskWithIterations = buildTask({
      iterationCount: 2,
      isInRework: true,
      lastReviewFeedback: 'Code quality issues',
      rejectionCount: 1,
    });
    render(<TraditionalTaskView tasks={[taskWithIterations]} />);

    expect(screen.getByText(/第 2 轮/)).toBeInTheDocument();
    expect(screen.getByText(/返工/)).toBeInTheDocument();
  });

  it('should display review rejection feedback', () => {
    const taskWithRejection = buildTask({
      rejectionCount: 1,
      lastReviewFeedback: 'Missing unit tests for new API endpoint',
    });
    render(<TraditionalTaskView tasks={[taskWithRejection]} />);

    expect(screen.getByText(/Missing unit tests/)).toBeInTheDocument();
  });

  it('should display multiple rejections with latest feedback', () => {
    const taskWithMultipleRejections = buildTask({
      rejectionCount: 2,
      iterationCount: 2,
      lastReviewFeedback: 'Still missing error handling for edge cases',
    });
    render(<TraditionalTaskView tasks={[taskWithMultipleRejections]} />);

    expect(screen.getByText(/2 次/)).toBeInTheDocument();
    expect(screen.getByText(/Still missing error handling/)).toBeInTheDocument();
  });

  it('should show attention badge for failed tasks', () => {
    const failedTask = buildTask({
      status: 'failed',
      currentPhase: 'done',
      failureSummary: 'compilation error',
    });
    render(<TraditionalTaskView tasks={[failedTask]} />);

    expect(screen.getByText(/Failed/)).toBeInTheDocument();
  });

  it('should show attention badge for stagnant tasks', () => {
    const stagnantTask = buildTask({
      status: 'in_progress',
      updatedAt: Date.now() - 5 * 60 * 1000,
    });
    render(<TraditionalTaskView tasks={[stagnantTask]} />);

    expect(screen.getByText(/停滞/)).toBeInTheDocument();
  });

  it('should sort tasks with attention signals first', () => {
    const normalTask = buildTask({ taskId: 'task-1', status: 'in_progress', updatedAt: Date.now() });
    const failedTask = buildTask({ taskId: 'task-2', status: 'failed', currentPhase: 'done' });
    const stagnantTask = buildTask({ taskId: 'task-3', status: 'in_progress', updatedAt: Date.now() - 10 * 60 * 1000 });
    const completedTask = buildTask({ taskId: 'task-4', status: 'completed' });
    const rejectedTask = buildTask({ taskId: 'task-5', rejectionCount: 1, lastReviewFeedback: 'feedback', isInRework: true });

    const tasks = [normalTask, failedTask, stagnantTask, completedTask, rejectedTask];
    render(<TraditionalTaskView tasks={tasks} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent(/task-2/);
    expect(buttons[1]).toHaveTextContent(/task-5/);
    expect(buttons[2]).toHaveTextContent(/task-3/);
  });

  it('should display wait duration with human readable format', () => {
    const taskWaiting = buildTask({
      currentPhase: 'reviewer',
      status: 'in_progress',
      recentEvents: [
        { type: 'task:handover', timestamp: Date.now() - 5 * 60 * 1000, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-1', description: 'Task' },
      ],
    });
    render(<TraditionalTaskView tasks={[taskWaiting]} />);

    expect(screen.getByText(/5分钟/)).toBeInTheDocument();
  });

  it('should display approved status after workflow:iteration-complete', () => {
    const approvedTask = buildTask({
      lastApproved: true,
      iterationCount: 1,
    });
    render(<TraditionalTaskView tasks={[approvedTask]} />);

    expect(screen.getByText(/已通过/)).toBeInTheDocument();
  });
});
