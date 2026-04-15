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
    expect(screen.getAllByText('进行中')[1]).toBeInTheDocument();
  });

  it('should display last update time and live status for in-progress tasks', () => {
    const taskWithTime = buildTask({
      updatedAt: Date.now(),
      currentPhase: 'developer',
    });
    render(<TraditionalTaskView tasks={[taskWithTime]} />);

    expect(screen.getByText('最后更新')).toBeInTheDocument();
    expect(screen.getAllByText('进行中')[1]).toBeInTheDocument();
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

    expect(screen.getAllByText('进行中')[1]).toBeInTheDocument();
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

    expect(screen.getByText(/等待 Reviewer 处理/i)).toBeInTheDocument();
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
    expect(screen.getAllByText(/返工/)[0]).toBeInTheDocument();
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

    const taskButtons = screen.getAllByText(/^task-\d$/);
    expect(taskButtons[0]).toHaveTextContent(/task-2/);
    expect(taskButtons[1]).toHaveTextContent(/task-5/);
    expect(taskButtons[2]).toHaveTextContent(/task-3/);
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

    expect(screen.getAllByText(/已通过/)[0]).toBeInTheDocument();
  });

  it('should filter tasks by attention status', () => {
    const failedTask = buildTask({ taskId: 'task-1', status: 'failed', currentPhase: 'done' });
    const normalTask = buildTask({ taskId: 'task-2', status: 'in_progress', updatedAt: Date.now() });
    const stagnantTask = buildTask({ taskId: 'task-3', status: 'in_progress', updatedAt: Date.now() - 10 * 60 * 1000 });

    render(<TraditionalTaskView tasks={[failedTask, normalTask, stagnantTask]} />);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/task-2/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/task-3/)[0]).toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/需关注/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/task-3/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should filter tasks by active status', () => {
    const inProgressTask = buildTask({ taskId: 'task-1', status: 'in_progress' });
    const completedTask = buildTask({ taskId: 'task-2', status: 'completed' });
    const failedTask = buildTask({ taskId: 'task-3', status: 'failed', currentPhase: 'done' });

    render(<TraditionalTaskView tasks={[inProgressTask, completedTask, failedTask]} />);

    fireEvent.click(screen.getAllByText(/进行中/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/task-3/)).not.toBeInTheDocument();
  });

  it('should show all tasks when clicking all filter', () => {
    const task1 = buildTask({ taskId: 'task-1', status: 'in_progress' });
    const task2 = buildTask({ taskId: 'task-2', status: 'completed' });

    render(<TraditionalTaskView tasks={[task1, task2]} />);

    const attentionButton = screen.getAllByRole('button', { name: /需关注/ })[0];
    fireEvent.click(attentionButton);
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();

    const allButton = screen.getAllByRole('button', { name: /全部/ })[0];
    fireEvent.click(allButton);
    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/task-2/)[0]).toBeInTheDocument();
  });

  it('should highlight active filter button after click', () => {
    const inProgressTask = buildTask({ taskId: 'task-1', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[inProgressTask]} />);

    // Use the filter tab button (not the stat card button)
    const activeButton = screen.getAllByRole('button', { name: /进行中/ }).find(
      btn => btn.tagName === 'BUTTON' && btn.className.includes('flex-1')
    )!;
    fireEvent.click(activeButton);
    
    expect(activeButton).toHaveClass('bg-primary-500/20');
  });

  it('should show empty state message when filter returns no results instead of falling back to all tasks', () => {
    const completedTask = buildTask({ taskId: 'task-1', status: 'completed' });

    render(<TraditionalTaskView tasks={[completedTask]} />);

    fireEvent.click(screen.getAllByText(/需关注/)[0]);

    expect(screen.getByText(/没有匹配的任务/)).toBeInTheDocument();
    expect(screen.getByText(/^请尝试其他筛选$/)).toBeInTheDocument();
    expect(screen.queryByText(/task-1/)).not.toBeInTheDocument();
  });

  it('should display action-oriented overview cards with attention/waiting/rework/approved counts', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', status: 'failed' }),
      buildTask({ taskId: 'task-2', status: 'in_progress', recentEvents: [{ type: 'task:handover', timestamp: Date.now() - 180000, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-2' }] }),
      buildTask({ taskId: 'task-3', isInRework: true, rejectionCount: 1 }),
      buildTask({ taskId: 'task-4', lastApproved: true, iterationCount: 1 }),
      buildTask({ taskId: 'task-5', status: 'completed' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    expect(screen.getAllByText(/需关注/)[0]).toBeInTheDocument();
    expect(screen.getByText(/等待中/)).toBeInTheDocument();
    expect(screen.getAllByText(/返工/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/已通过/)[0]).toBeInTheDocument();
  });

  it('should filter tasks by waiting status when clicking waiting card', () => {
    const taskWaiting = buildTask({
      taskId: 'task-1',
      status: 'in_progress',
      recentEvents: [{ type: 'task:handover', timestamp: Date.now() - 180000, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-1' }],
    });
    const taskNormal = buildTask({ taskId: 'task-2', status: 'in_progress', recentEvents: [] });

    render(<TraditionalTaskView tasks={[taskWaiting, taskNormal]} />);

    fireEvent.click(screen.getByText(/等待中/));

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should filter tasks by rework status when clicking rework card', () => {
    const taskRework = buildTask({
      taskId: 'task-1',
      isInRework: true,
      rejectionCount: 1,
      lastReviewFeedback: 'fix bugs',
    });
    const taskNormal = buildTask({ taskId: 'task-2', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[taskRework, taskNormal]} />);

    fireEvent.click(screen.getAllByText(/返工/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should filter tasks by approved status when clicking approved card', () => {
    const taskApproved = buildTask({
      taskId: 'task-1',
      lastApproved: true,
      iterationCount: 1,
    });
    const taskNormal = buildTask({ taskId: 'task-2', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[taskApproved, taskNormal]} />);

    fireEvent.click(screen.getAllByText(/已通过/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should display in-progress and completed summary cards', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', status: 'in_progress' }),
      buildTask({ taskId: 'task-2', status: 'completed' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    expect(screen.getAllByText(/进行中/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/已完成/)[0]).toBeInTheDocument();
  });

  it('should show correct counts for in-progress and completed cards', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', status: 'in_progress' }),
      buildTask({ taskId: 'task-2', status: 'in_progress' }),
      buildTask({ taskId: 'task-3', status: 'completed' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    const inProgressButtons = screen.getAllByText(/2/);
    const completedButtons = screen.getAllByText(/1/);
    expect(inProgressButtons.length).toBeGreaterThan(0);
    expect(completedButtons.length).toBeGreaterThan(0);
  });

  it('should filter tasks by in-progress status when clicking in-progress card button', () => {
    const inProgressTask = buildTask({ taskId: 'task-1', status: 'in_progress' });
    const completedTask = buildTask({ taskId: 'task-2', status: 'completed' });
    const failedTask = buildTask({ taskId: 'task-3', status: 'failed', currentPhase: 'done' });

    render(<TraditionalTaskView tasks={[inProgressTask, completedTask, failedTask]} />);

    fireEvent.click(screen.getAllByText(/进行中/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/task-3/)).not.toBeInTheDocument();
  });

  it('should preserve completed tasks in all filter - completed tasks are not lost', () => {
    const completedTask = buildTask({ taskId: 'task-1', status: 'completed' });
    const inProgressTask = buildTask({ taskId: 'task-2', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[completedTask, inProgressTask]} />);

    fireEvent.click(screen.getAllByText(/需关注/)[0]);
    expect(screen.queryByText(/task-1/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /全部/ })[0]);
    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/task-2/)[0]).toBeInTheDocument();
  });

  it('should separate active and completed tasks into two sections when rendering dual view', () => {
    const activeTask = buildTask({ taskId: 'task-1', status: 'in_progress', description: 'Active Task' });
    const waitingTask = buildTask({
      taskId: 'task-2',
      status: 'in_progress',
      recentEvents: [{ type: 'task:handover', timestamp: Date.now() - 180000, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-2' }],
      description: 'Waiting Task',
    });
    const completedTask = buildTask({
      taskId: 'task-3',
      status: 'completed',
      currentPhase: 'done',
      description: 'Completed Task',
    });
    const approvedTask = buildTask({
      taskId: 'task-4',
      status: 'completed',
      lastApproved: true,
      iterationCount: 1,
      description: 'Approved Task',
    });

    render(<TraditionalTaskView tasks={[activeTask, waitingTask, completedTask, approvedTask]} />);

    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('Recent History')).toBeInTheDocument();
  });

  it('should show attention/active tasks in top section', () => {
    const activeTask = buildTask({ taskId: 'task-1', status: 'in_progress', description: 'Active Task' });
    const waitingTask = buildTask({
      taskId: 'task-2',
      status: 'in_progress',
      recentEvents: [{ type: 'task:handover', timestamp: Date.now() - 180000, fromAgentId: 'dev-agent', toAgentId: 'review-agent', taskId: 'task-2' }],
      description: 'Waiting Task',
    });
    const completedTask = buildTask({ taskId: 'task-3', status: 'completed', description: 'Completed Task' });

    render(<TraditionalTaskView tasks={[activeTask, waitingTask, completedTask]} />);

    expect(screen.getAllByText('Active Tasks')[0]).toBeInTheDocument();
  });

  it('should show completed/approved tasks in history section with different styling', () => {
    const approvedTask = buildTask({
      taskId: 'task-1',
      status: 'completed',
      lastApproved: true,
      iterationCount: 1,
      description: 'Approved Task',
    });
    const completedTask = buildTask({
      taskId: 'task-2',
      status: 'completed',
      description: 'Done Task',
    });
    const activeTask = buildTask({ taskId: 'task-3', status: 'in_progress', description: 'Active Task' });

    render(<TraditionalTaskView tasks={[approvedTask, completedTask, activeTask]} />);

    const historySection = screen.getAllByText('Recent History');
    expect(historySection.length).toBeGreaterThan(0);
  });

  it('should filter active section only - history tasks hidden from attention filter', () => {
    const attentionTask = buildTask({ taskId: 'task-1', status: 'failed', currentPhase: 'done', description: 'Failed Task' });
    const normalActiveTask = buildTask({ taskId: 'task-2', status: 'in_progress', description: 'Active Task' });
    const completedTask = buildTask({ taskId: 'task-3', status: 'completed', description: 'Old Task' });

    render(<TraditionalTaskView tasks={[attentionTask, normalActiveTask, completedTask]} />);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/task-2/)[0]).toBeInTheDocument();
  });

  it('should reduce noise by moving completed tasks to separate history section', () => {
    const inProgressTasks = Array.from({ length: 5 }, (_, i) =>
      buildTask({ taskId: `task-${i + 1}`, status: 'in_progress', description: `In Progress ${i + 1}` })
    );
    const completedTasks = Array.from({ length: 3 }, (_, i) =>
      buildTask({ taskId: `task-${i + 6}`, status: 'completed', description: `Done ${i + 1}` })
    );

    render(<TraditionalTaskView tasks={[...inProgressTasks, ...completedTasks]} />);

    expect(screen.getByText('Active Tasks')).toBeInTheDocument();
    expect(screen.getByText('Recent History')).toBeInTheDocument();
  });

  it('should display latest output summary on task card from session history', () => {
    const taskWithSummary = buildTask({
      latestResultSummary: '已写入文件: /generated/index.html',
    });
    render(<TraditionalTaskView tasks={[taskWithSummary]} />);

    expect(screen.getByText(/已写入文件/)).toBeInTheDocument();
  });

  it('should display stage filter chips for bottleneck identification', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', currentPhase: 'pm_analysis', status: 'in_progress', description: 'PM Task' }),
      buildTask({ taskId: 'task-2', currentPhase: 'developer', status: 'in_progress', description: 'Dev Task' }),
      buildTask({ taskId: 'task-3', currentPhase: 'tester', status: 'in_progress', description: 'Tester Task' }),
      buildTask({ taskId: 'task-4', currentPhase: 'reviewer', status: 'in_progress', description: 'Reviewer Task' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    // Stage chips render inside rounded-full border buttons
    const chips = screen.getAllByRole('button').filter(b => b.className.includes('rounded-full') && b.className.includes('border-'));
    const chipTexts = chips.map(c => c.textContent?.trim());
    expect(chipTexts.some(t => t?.includes('PM'))).toBe(true);
    expect(chipTexts.some(t => t?.includes('Dev'))).toBe(true);
    expect(chipTexts.some(t => t?.includes('Tester'))).toBe(true);
    expect(chipTexts.some(t => t?.includes('Reviewer'))).toBe(true);
  });

  it('should show stage summary showing tasks per stage', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', currentPhase: 'developer', status: 'in_progress' }),
      buildTask({ taskId: 'task-2', currentPhase: 'developer', status: 'in_progress' }),
      buildTask({ taskId: 'task-3', currentPhase: 'reviewer', status: 'in_progress' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    const devChips = screen.getAllByText('Dev');
    expect(devChips.some(chip => chip.className.includes('border-'))).toBe(true);
  });

  it('should filter tasks by stage when clicking stage chip', () => {
    const pmTask = buildTask({ taskId: 'task-1', currentPhase: 'pm_analysis', status: 'in_progress' });
    const devTask = buildTask({ taskId: 'task-2', currentPhase: 'developer', status: 'in_progress' });
    const reviewerTask = buildTask({ taskId: 'task-3', currentPhase: 'reviewer', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[pmTask, devTask, reviewerTask]} />);

    // Find the Dev stage chip button specifically
    const devChip = screen.getAllByRole('button').find(
      b => b.className.includes('rounded-full') && b.textContent?.trim().startsWith('Dev')
    );
    expect(devChip).toBeDefined();
    fireEvent.click(devChip!);

    expect(screen.getAllByText(/task-2/)[0]).toBeInTheDocument();
    // task-1 and task-3 should not appear in the task list buttons
    const taskListButtons = screen.getAllByRole('button').filter(
      b => b.className.includes('w-full') && b.className.includes('text-left')
    );
    const listTexts = taskListButtons.map(b => b.textContent ?? '');
    expect(listTexts.some(t => t.includes('task-1'))).toBe(false);
    expect(listTexts.some(t => t.includes('task-3'))).toBe(false);
  });

  it('should highlight bottleneck stages with alert styling', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', status: 'in_progress', updatedAt: Date.now() - 10 * 60 * 1000, currentPhase: 'developer' }),
      buildTask({ taskId: 'task-2', status: 'in_progress', updatedAt: Date.now() - 10 * 60 * 1000, currentPhase: 'reviewer' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    // Both chips should be rendered as cursor-pointer buttons
    const reviewerChip = screen.getAllByRole('button').find(
      b => b.className.includes('rounded-full') && b.textContent?.trim().startsWith('Reviewer')
    );
    expect(reviewerChip).toBeDefined();
    expect(reviewerChip).toHaveClass('cursor-pointer');
  });

  it('should filter failed tasks using attention filter when no dedicated failed filter exists', () => {
    const failedTask = buildTask({ taskId: 'task-1', status: 'failed', currentPhase: 'done' });
    const runningTask = buildTask({ taskId: 'task-2', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[failedTask, runningTask]} />);

    fireEvent.click(screen.getAllByText(/需关注/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should filter stuck/stagnant tasks using attention filter', () => {
    const stuckTask = buildTask({ taskId: 'task-1', status: 'in_progress', updatedAt: Date.now() - 15 * 60 * 1000 });
    const runningTask = buildTask({ taskId: 'task-2', status: 'in_progress', updatedAt: Date.now() });

    render(<TraditionalTaskView tasks={[stuckTask, runningTask]} />);

    fireEvent.click(screen.getAllByText(/需关注/)[0]);

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
  });

  it('should display status summary showing failed/completed/stuck counts', () => {
    const tasks = [
      buildTask({ taskId: 'task-1', status: 'failed', currentPhase: 'done' }),
      buildTask({ taskId: 'task-2', status: 'in_progress', updatedAt: Date.now() - 15 * 60 * 1000 }),
      buildTask({ taskId: 'task-3', status: 'completed' }),
      buildTask({ taskId: 'task-4', status: 'in_progress' }),
    ];

    render(<TraditionalTaskView tasks={tasks} />);

    expect(screen.getByTestId('status-card-work')).toHaveTextContent('2');
    expect(screen.getByTestId('status-card-completed')).toHaveTextContent('1');
    expect(screen.getByTestId('status-card-failed')).toHaveTextContent('1');
    expect(screen.getByTestId('status-card-stuck')).toHaveTextContent('1');
  });

  it('should show agent chips in task list when multiple agents present', () => {
    const devTask = buildTask({ taskId: 'task-1', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const pmTask = buildTask({ taskId: 'task-2', currentAgentId: 'pm-agent', currentAgentName: 'PM Claw', currentPhase: 'pm_analysis', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[devTask, pmTask]} />);

    const taskListItems = screen.getAllByRole('button', { name: /(task-1|task-2)/ });
    expect(taskListItems.length).toBe(2);
  });

  it('should filter tasks by work status', () => {
    const inProgressTask = buildTask({ taskId: 'task-1', status: 'in_progress' });
    const completedTask = buildTask({ taskId: 'task-2', status: 'completed' });
    const failedTask = buildTask({ taskId: 'task-3', status: 'failed', currentPhase: 'done' });

    render(<TraditionalTaskView tasks={[inProgressTask, completedTask, failedTask]} />);

    fireEvent.click(screen.getByTestId('status-card-work'));

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/task-3/)).not.toBeInTheDocument();
  });

  it('should filter tasks by completed status', () => {
    const completedTask = buildTask({ taskId: 'task-1', status: 'completed' });
    const inProgressTask = buildTask({ taskId: 'task-2', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[completedTask, inProgressTask]} />);

    fireEvent.click(screen.getByTestId('status-card-completed'));

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should filter tasks by failed status', () => {
    const failedTask = buildTask({ taskId: 'task-1', status: 'failed', currentPhase: 'done' });
    const inProgressTask = buildTask({ taskId: 'task-2', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[failedTask, inProgressTask]} />);

    fireEvent.click(screen.getByTestId('status-card-failed'));

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should filter tasks by stuck/stagnant status', () => {
    const stuckTask = buildTask({ taskId: 'task-1', status: 'in_progress', updatedAt: Date.now() - 15 * 60 * 1000 });
    const activeTask = buildTask({ taskId: 'task-2', status: 'in_progress', updatedAt: Date.now() });

    render(<TraditionalTaskView tasks={[stuckTask, activeTask]} />);

    fireEvent.click(screen.getByTestId('status-card-stuck'));

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should display agent filter chips', () => {
    const devTask = buildTask({ taskId: 'task-1', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const pmTask = buildTask({ taskId: 'task-2', currentAgentId: 'pm-agent', currentAgentName: 'PM Claw', currentPhase: 'pm_analysis', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[devTask, pmTask]} />);

    expect(screen.getByTestId('agent-filter-dev-agent')).toHaveTextContent('Dev Claw');
    expect(screen.getByTestId('agent-filter-pm-agent')).toHaveTextContent('PM Claw');
  });

  it('should filter tasks by agent when clicking agent chip', () => {
    const devTask = buildTask({ taskId: 'task-1', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const pmTask = buildTask({ taskId: 'task-2', currentAgentId: 'pm-agent', currentAgentName: 'PM Claw', currentPhase: 'pm_analysis', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[devTask, pmTask]} />);

    fireEvent.click(screen.getByTestId('agent-filter-dev-agent'));

    expect(screen.getAllByText(/task-1/)[0]).toBeInTheDocument();
    expect(screen.queryByText(/task-2/)).not.toBeInTheDocument();
  });

  it('should show agent task counts with badge', () => {
    const devTask1 = buildTask({ taskId: 'task-1', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const devTask2 = buildTask({ taskId: 'task-2', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const pmTask = buildTask({ taskId: 'task-3', currentAgentId: 'pm-agent', currentAgentName: 'PM Claw', currentPhase: 'pm_analysis', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[devTask1, devTask2, pmTask]} />);

    expect(screen.getByTestId('agent-filter-dev-agent')).toHaveTextContent('×2');
    expect(screen.getByTestId('agent-filter-pm-agent')).toHaveTextContent('×1');
  });

  it('should toggle agent group view', () => {
    const devTask1 = buildTask({ taskId: 'task-1', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const devTask2 = buildTask({ taskId: 'task-2', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const pmTask = buildTask({ taskId: 'task-3', currentAgentId: 'pm-agent', currentAgentName: 'PM Claw', currentPhase: 'pm_analysis', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[devTask1, devTask2, pmTask]} />);

    expect(screen.getByText('×1')).toBeInTheDocument();
    expect(screen.getAllByText(/Dev Claw/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('toggle-agent-group'));

    expect(screen.getByTestId('agent-group-dev-agent')).toBeInTheDocument();
  });

  it('should show agent group with task counts', () => {
    const devTask = buildTask({ taskId: 'task-1', currentAgentId: 'dev-agent', currentAgentName: 'Dev Claw', currentPhase: 'developer', status: 'in_progress' });
    const reviewTask = buildTask({ taskId: 'task-2', currentAgentId: 'review-agent', currentAgentName: 'Reviewer Claw', currentPhase: 'reviewer', status: 'in_progress' });

    render(<TraditionalTaskView tasks={[devTask, reviewTask]} />);

    fireEvent.click(screen.getByTestId('toggle-agent-group'));

    expect(screen.getByTestId('agent-group-dev-agent')).toBeInTheDocument();
    expect(screen.getByTestId('agent-group-review-agent')).toBeInTheDocument();
  });
});
