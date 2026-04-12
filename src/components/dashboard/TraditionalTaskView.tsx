'use client';

import { GameEvent } from '@/game/types/GameEvents';
import { useEffect, useMemo, useState } from 'react';

import { TaskHistory, TASK_PHASE_LABELS } from '@/game/data/DashboardStore';

type EventSummary = {
  text: string;
  type: string;
};

function summarizeEvent(event: GameEvent): EventSummary | null {
  switch (event.type) {
    case 'task:assigned':
      return { text: '分配', type: event.type };
    case 'task:handover': {
      const toAgent = event.toAgentId?.includes('review') ? 'Reviewer'
        : event.toAgentId?.includes('test') ? 'Tester'
        : event.toAgentId?.includes('dev') ? 'Developer'
        : event.toAgentId ?? 'unknown';
      return { text: `交接给 ${toAgent}`, type: event.type };
    }
    case 'task:progress':
      return { text: event.currentAction?.slice(0, 30) || '进行中', type: event.type };
    case 'task:completed':
      return { text: event.result === 'success' ? '完成' : `完成(${event.result})`, type: event.type };
    case 'task:failed':
      return { text: '失败', type: event.type };
    case 'review:rejected':
      return { text: 'Reviewer 打回', type: event.type };
    case 'dev:iteration-start':
      return { text: '进入新一轮开发', type: event.type };
    case 'workflow:iteration-complete':
      return { text: event.payload?.approved ? '本轮通过' : '本轮未通过', type: event.type };
    case 'agent:status-change':
      return { text: `状态: ${event.status}`, type: event.type };
    case 'agent:task-assigned':
      return { text: '开始处理', type: event.type };
    case 'agent:task-completed':
      return { text: event.result === 'failure' ? '处理失败' : '处理完成', type: event.type };
    default:
      return null;
  }
}

interface TraditionalTaskViewProps {
  tasks: TaskHistory[];
}

const TASK_STATUS_STYLES = {
  in_progress: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  completed: 'bg-green-500/15 text-green-300 border-green-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  approved: 'bg-green-500/15 text-green-300 border-green-500/30',
} as const;

const PHASE_STATUS_STYLES = {
  pending: 'border-dark-100 bg-dark-50/30 text-gray-500',
  in_progress: 'border-primary-500/40 bg-primary-500/10 text-primary-200',
  completed: 'border-green-500/30 bg-green-500/10 text-green-200',
  failed: 'border-red-500/30 bg-red-500/10 text-red-200',
} as const;

function formatTime(timestamp?: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) {
    return `${minutes}分钟`;
  }
  return `${seconds}秒`;
}

function getTaskStatusLabel(task: TaskHistory): string {
  if (task.status === 'failed') return 'Failed';
  if (task.lastApproved) return 'Approved';
  if (task.status === 'completed') return 'Done';
  return 'In Progress';
}

function isTaskStagnant(task: TaskHistory): boolean {
  if (task.status !== 'in_progress') return false;
  const stagnationThreshold = 3 * 60 * 1000;
  return Date.now() - task.updatedAt > stagnationThreshold;
}

function getWaitDuration(task: TaskHistory): string | null {
  const lastHandover = (task.recentEvents ?? []).find(e => e.type === 'task:handover');
  if (!lastHandover?.timestamp) return null;
  const waitMs = Date.now() - lastHandover.timestamp;
  if (waitMs < 60000) return null;
  return formatDuration(waitMs);
}

function getLastProgress(task: TaskHistory): string | null {
  const lastProgress = (task.recentEvents ?? []).find(e => e.type === 'task:progress');
  return lastProgress?.currentAction ?? null;
}

function getCurrentBlocker(task: TaskHistory): string {
  if (task.status !== 'in_progress') {
    if (task.status === 'failed') {
      return '任务失败，查看错误摘要';
    }
    return '任务已完成';
  }

  const lastEvent = (task.recentEvents ?? [])[(task.recentEvents ?? []).length - 1];
  if (lastEvent?.type === 'task:handover' && lastEvent.toAgentId) {
    const waitingOn = lastEvent.toAgentId.includes('review') ? 'Reviewer'
      : lastEvent.toAgentId.includes('test') ? 'Tester'
      : lastEvent.toAgentId.includes('dev') ? 'Developer'
      : lastEvent.toAgentId;

    const parts = [`等待 ${waitingOn} 处理`];
    const waitDuration = getWaitDuration(task);
    if (waitDuration) {
      parts.push(`(${waitDuration})`);
    }
    return parts.join(' ');
  }

  const lastProgress = getLastProgress(task);
  if (lastProgress) {
    return `最近进展: ${lastProgress.slice(0, 40)}`;
  }

  if (task.isInRework && task.lastReviewFeedback) {
    return `Reviewer 打回: ${task.lastReviewFeedback.slice(0, 40)}`;
  }

  const phaseLabel = TASK_PHASE_LABELS[task.currentPhase];
  const owner = task.currentAgentName ?? 'Unassigned';
  return `${phaseLabel} · ${owner}`;
}

function getTaskPriority(task: TaskHistory): number {
  if (task.status === 'failed') return 40;
  if ((task.rejectionCount ?? 0) > 0 || task.isInRework) return 30;
  if (isTaskStagnant(task)) return 20;
  if (task.lastApproved) return 15;
  if (task.status === 'completed') return 0;
  return 10;
}

function getAttentionBadges(task: TaskHistory): string[] {
  const badges: string[] = [];

  if (task.status === 'failed') badges.push('ALERT');
  if ((task.rejectionCount ?? 0) > 0) badges.push(`${task.rejectionCount}x review`);
  if (task.isInRework) badges.push('REWORK');
  if (isTaskStagnant(task)) badges.push('STALE');
  if (task.lastApproved) badges.push('PASS');

  return badges;
}

type FilterType = 'attention' | 'active' | 'all' | 'waiting' | 'rework' | 'approved' | 'completed';
type StageFilterType = 'all' | 'pm' | 'developer' | 'tester' | 'reviewer' | 'done';

function isActiveTask(task: TaskHistory): boolean {
  return task.status === 'in_progress' || task.status === 'failed';
}

function isHistoricalTask(task: TaskHistory): boolean {
  return task.status === 'completed' || task.lastApproved === true;
}

interface TaskListItemProps {
  task: TaskHistory;
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  isHistory?: boolean;
}

function TaskListItem({ task, selectedTaskId, onSelect, isHistory }: TaskListItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task.taskId)}
      className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
        selectedTaskId === task.taskId
          ? 'border-primary-500/40 bg-primary-500/10'
          : isHistory
            ? 'border-dark-100/50 bg-dark-50/20 hover:border-dark-50'
            : 'border-dark-100 bg-dark-50/40 hover:border-dark-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 mb-1">{task.taskId}</div>
          <div className="text-sm text-white font-medium line-clamp-2">{task.description}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${TASK_STATUS_STYLES[task.status]}`}>
          {getTaskStatusLabel(task)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
        <span className="truncate">{task.currentAgentName ?? TASK_PHASE_LABELS[task.currentPhase]}</span>
        <span>{formatTime(task.updatedAt)}</span>
      </div>
      {getAttentionBadges(task).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {getAttentionBadges(task).map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-dark-100 bg-dark-100/40 px-2 py-0.5 text-[10px] text-gray-300"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

const STAGE_LABELS: Record<string, string> = {
  pm: 'PM',
  developer: 'Dev',
  tester: 'Tester',
  reviewer: 'Reviewer',
  done: 'Done',
};

const STAGE_COLORS: Record<string, string> = {
  pm: 'bg-purple-500/10 border-purple-500/30 text-purple-200 hover:border-purple-500/50',
  developer: 'bg-blue-500/10 border-blue-500/30 text-blue-200 hover:border-blue-500/50',
  tester: 'bg-orange-500/10 border-orange-500/30 text-orange-200 hover:border-orange-500/50',
  reviewer: 'bg-pink-500/10 border-pink-500/30 text-pink-200 hover:border-pink-500/50',
  done: 'bg-green-500/10 border-green-500/30 text-green-200 hover:border-green-500/50',
};

const STAGE_BOTTLENECK_COLORS: Record<string, string> = {
  pm: 'bg-purple-500/20 border-purple-500/50 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.4)]',
  developer: 'bg-blue-500/20 border-blue-500/50 text-blue-100 shadow-[0_0_12px_rgba(59,130,246,0.4)]',
  tester: 'bg-orange-500/20 border-orange-500/50 text-orange-100 shadow-[0_0_12px_rgba(249,115,22,0.4)]',
  reviewer: 'bg-pink-500/20 border-pink-500/50 text-pink-100 shadow-[0_0_12px_rgba(236,72,153,0.4)]',
  done: 'bg-green-500/20 border-green-500/50 text-green-100 shadow-[0_0_12px_rgba(34,197,94,0.4)]',
};

export function TraditionalTaskView({ tasks }: TraditionalTaskViewProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [stageFilter, setStageFilter] = useState<StageFilterType>('all');
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => getTaskPriority(b) - getTaskPriority(a) || b.updatedAt - a.updatedAt),
    [tasks],
  );
  const filteredTasks = useMemo(() => {
    if (filter === 'all') return sortedTasks;
    if (filter === 'attention') {
      return sortedTasks.filter(task =>
        task.status === 'failed' ||
        (task.rejectionCount ?? 0) > 0 ||
        task.isInRework ||
        isTaskStagnant(task) ||
        task.lastApproved
      );
    }
    if (filter === 'waiting') {
      return sortedTasks.filter(task => {
        if (task.status !== 'in_progress') return false;
        const lastHandover = (task.recentEvents ?? []).find(e => e.type === 'task:handover');
        return !!lastHandover?.toAgentId;
      });
    }
    if (filter === 'rework') {
      return sortedTasks.filter(task => task.isInRework || (task.rejectionCount ?? 0) > 0);
    }
    if (filter === 'approved') {
      return sortedTasks.filter(task => task.lastApproved);
    }
    if (filter === 'completed') {
      return sortedTasks.filter(task => task.status === 'completed');
    }
    return sortedTasks.filter(task => task.status === 'in_progress');
  }, [sortedTasks, filter]);

  const hasFilterApplied = filter !== 'all';
  const isFilteredEmpty = hasFilterApplied && filteredTasks.length === 0;
  const displayTasks = isFilteredEmpty ? [] : filteredTasks.length > 0 ? filteredTasks : sortedTasks;

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { pm: 0, developer: 0, tester: 0, reviewer: 0, done: 0 };
    sortedTasks.forEach(task => {
      if (task.currentPhase === 'pm_analysis' || task.currentPhase === 'planning') {
        counts.pm++;
      } else if (task.currentPhase === 'developer') {
        counts.developer++;
      } else if (task.currentPhase === 'tester') {
        counts.tester++;
      } else if (task.currentPhase === 'reviewer') {
        counts.reviewer++;
      } else if (task.currentPhase === 'done') {
        counts.done++;
      }
    });
    return counts;
  }, [sortedTasks]);

  const displayTasksByStage = useMemo(() => {
    if (stageFilter === 'all') return displayTasks;
    if (stageFilter === 'pm') {
      return displayTasks.filter(t => t.currentPhase === 'pm_analysis' || t.currentPhase === 'planning');
    }
    return displayTasks.filter(t => t.currentPhase === stageFilter);
  }, [displayTasks, stageFilter]);

  const hasStageFilterApplied = stageFilter !== 'all';
  const displayTasksFinal = hasStageFilterApplied ? displayTasksByStage : displayTasks;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(displayTasksFinal[0]?.taskId ?? null);

  useEffect(() => {
    if (!tasks.length) {
      setSelectedTaskId(null);
      return;
    }

    if (!selectedTaskId || !displayTasksFinal.some(task => task.taskId === selectedTaskId)) {
      const next = displayTasksFinal[0]?.taskId ?? null;
      if (next !== selectedTaskId) {
        setSelectedTaskId(next);
      }
    }
  }, [selectedTaskId, displayTasksFinal, tasks.length]);

  const selectedTask = useMemo(
    () => displayTasksFinal.find(task => task.taskId === selectedTaskId) ?? displayTasksFinal[0] ?? null,
    [selectedTaskId, displayTasksFinal],
  );

  const hasSelectedTask = selectedTask !== null;

  if (!sortedTasks.length) {
    return (
      <div data-testid="traditional-task-view" className="glass rounded-2xl border border-dark-100 p-6 h-full">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Timeline View</p>
            <h2 className="text-xl font-semibold text-white">Traditional Task Tracker</h2>
          </div>
        </div>
        <div className="h-full min-h-[360px] rounded-xl border border-dashed border-dark-100 bg-dark-50/20 flex items-center justify-center text-sm text-gray-500">
          Waiting for task lifecycle events...
        </div>
      </div>
    );
  }

  return (
    <div data-testid="traditional-task-view" className="glass rounded-2xl border border-dark-100 p-4 md:p-5 h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Timeline View</p>
          <h2 className="text-xl font-semibold text-white">Traditional Task Tracker</h2>
          <p className="text-sm text-gray-400 mt-1">更清楚地看单个任务卡在哪一步，而不只是看办公室动画。</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto">
          {(() => {
            const attentionCount = sortedTasks.filter(t => t.status === 'failed' || (t.rejectionCount ?? 0) > 0 || t.isInRework || isTaskStagnant(t)).length;
            const waitingCount = sortedTasks.filter(t => {
              if (t.status !== 'in_progress') return false;
              const lastHandover = (t.recentEvents ?? []).find(e => e.type === 'task:handover');
              return !!lastHandover?.toAgentId;
            }).length;
            const reworkCount = sortedTasks.filter(t => t.isInRework || (t.rejectionCount ?? 0) > 0).length;
            const approvedCount = sortedTasks.filter(t => t.lastApproved).length;
            const inProgressCount = sortedTasks.filter(t => t.status === 'in_progress').length;
            const completedCount = sortedTasks.filter(t => t.status === 'completed').length;
            return (
              <>
                <button
                  type="button"
                  onClick={() => setFilter('attention')}
                  className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                    attentionCount > 0
                      ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 cursor-pointer'
                      : 'bg-dark-50/40 border-dark-100 cursor-pointer'
                  }`}
                >
                  <div className="text-xs text-gray-500">需关注</div>
                  <div className={`text-lg font-semibold ${attentionCount > 0 ? 'text-yellow-300' : 'text-gray-400'}`}>{attentionCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('waiting')}
                  className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                    waitingCount > 0
                      ? 'bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50 cursor-pointer'
                      : 'bg-dark-50/40 border-dark-100 cursor-pointer'
                  }`}
                >
                  <div className="text-xs text-gray-500">等待中</div>
                  <div className={`text-lg font-semibold ${waitingCount > 0 ? 'text-blue-300' : 'text-gray-400'}`}>{waitingCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('rework')}
                  className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                    reworkCount > 0
                      ? 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50 cursor-pointer'
                      : 'bg-dark-50/40 border-dark-100 cursor-pointer'
                  }`}
                >
                  <div className="text-xs text-gray-500">返工</div>
                  <div className={`text-lg font-semibold ${reworkCount > 0 ? 'text-orange-300' : 'text-gray-400'}`}>{reworkCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('approved')}
                  className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                    approvedCount > 0
                      ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50 cursor-pointer'
                      : 'bg-dark-50/40 border-dark-100 cursor-pointer'
                  }`}
                >
                  <div className="text-xs text-gray-500">已通过</div>
                  <div className={`text-lg font-semibold ${approvedCount > 0 ? 'text-green-300' : 'text-gray-400'}`}>{approvedCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('active')}
                  className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                    inProgressCount > 0
                      ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50 cursor-pointer'
                      : 'bg-dark-50/40 border-dark-100 cursor-pointer'
                  }`}
                >
                  <div className="text-xs text-gray-500">进行中</div>
                  <div className={`text-lg font-semibold ${inProgressCount > 0 ? 'text-yellow-300' : 'text-gray-400'}`}>{inProgressCount}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('completed')}
                  className={`rounded-xl border px-3 py-2 text-center transition-colors ${
                    completedCount > 0
                      ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50 cursor-pointer'
                      : 'bg-dark-50/40 border-dark-100 cursor-pointer'
                  }`}
                >
                  <div className="text-xs text-gray-500">已完成</div>
                  <div className={`text-lg font-semibold ${completedCount > 0 ? 'text-green-300' : 'text-gray-400'}`}>{completedCount}</div>
                </button>
              </>
            );
          })()}
          <div className="flex gap-1.5 mt-3 md:mt-0 md:col-span-4 flex-wrap">
            {(['attention', 'waiting', 'rework', 'approved', 'active', 'completed', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-500/20 text-primary-200 border border-primary-500/30'
                    : 'bg-dark-50/40 text-gray-400 border border-dark-100 hover:border-dark-50'
                }`}
              >
                {f === 'attention' ? '需关注' : f === 'waiting' ? '等待' : f === 'rework' ? '返工' : f === 'approved' ? '已通过' : f === 'active' ? '进行中' : f === 'completed' ? '已完成' : '全部'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] h-[calc(100%-5.5rem)] min-h-[460px]">
        <section className="rounded-xl border border-dark-100 bg-dark-50/30 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-dark-100 flex flex-col gap-2">
            <div className="text-sm font-medium text-gray-200">Task List</div>
            {/* Stage filter chips */}
            <div className="flex flex-wrap gap-1">
              {(Object.entries(STAGE_LABELS) as [string, string][]).map(([stage, label]) => {
                const count = stageCounts[stage] ?? 0;
                if (count === 0) return null;
                const isBottleneck = count >= 2 && stage !== 'done';
                const isActive = stageFilter === stage;
                const colorClass = isActive
                  ? 'bg-primary-500/20 border-primary-500/40 text-primary-200'
                  : isBottleneck
                    ? STAGE_BOTTLENECK_COLORS[stage]
                    : STAGE_COLORS[stage];
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setStageFilter(isActive ? 'all' : stage as StageFilterType)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${colorClass}`}
                  >
                    {label} {count > 1 && <span className="opacity-70">×{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-y-auto p-2 space-y-3">
            {(() => {
              if (hasStageFilterApplied) {
                return displayTasksFinal.map((task) => (
                  <TaskListItem key={task.taskId} task={task} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
                ));
              }

              const activeTasks = filter === 'completed' || filter === 'approved' || filter === 'all'
                ? sortedTasks.filter(t => isActiveTask(t))
                : filteredTasks.filter(t => isActiveTask(t));
              const historyTasks = filter === 'all'
                ? sortedTasks.filter(t => isHistoricalTask(t))
                : [];
              const showDualSections = filter === 'all' && historyTasks.length > 0;

              if (showDualSections) {
                return (
                  <>
                    {activeTasks.length > 0 && (
                      <div>
                        <div className="px-2 py-1.5 text-xs font-medium text-primary-300 uppercase tracking-wide">
                          Active Tasks
                        </div>
                        <div className="space-y-2">
                          {activeTasks.map((task) => (
                            <TaskListItem key={task.taskId} task={task} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
                          ))}
                        </div>
                      </div>
                    )}
                    {historyTasks.length > 0 && (
                      <div>
                        <div className="px-2 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mt-2">
                          Recent History
                        </div>
                        <div className="space-y-2">
                          {historyTasks.slice(0, 3).map((task) => (
                            <TaskListItem key={task.taskId} task={task} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} isHistory />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              }

              return filteredTasks.map((task) => (
                <TaskListItem key={task.taskId} task={task} selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId} />
              ));
            })()}
            {isFilteredEmpty && (
              <div className="p-4 text-center">
                <div className="text-sm text-gray-500">没有匹配的任务</div>
                <div className="text-xs text-gray-400 mt-1">请尝试其他筛选</div>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="mt-3 px-3 py-1.5 text-xs text-primary-300 hover:text-primary-200 border border-primary-500/30 rounded-lg transition-colors"
                >
                  显示全部
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-dark-100 bg-dark-50/30 overflow-hidden flex flex-col min-h-0">
          {hasSelectedTask ? (
            <>
              <div className="px-4 py-3 border-b border-dark-100 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Selected Task</div>
                  <h3 className="text-lg font-semibold text-white">{selectedTask.description}</h3>
                  <p className="text-xs text-gray-500 mt-1">{selectedTask.taskId}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">Current Stage</div>
                  <div className="text-sm text-white">{TASK_PHASE_LABELS[selectedTask.currentPhase]}</div>
                  <div className="text-xs text-gray-400 mt-1">{selectedTask.currentAgentName ?? 'Unassigned'}</div>
                </div>
              </div>

              <div className="p-4 border-b border-dark-100 bg-dark-100/20">
                <div className="text-xs text-gray-500 mb-1">当前卡点</div>
                <div className="text-sm text-primary-200">{getCurrentBlocker(selectedTask)}</div>
              </div>

              {selectedTask.status === 'in_progress' && (
                <div className="p-4 border-b border-dark-100">
                  <div className="text-xs text-gray-500 mb-2">当前阶段说明</div>
                  <div className="text-sm text-gray-300">
                    正在处理任务：{TASK_PHASE_LABELS[selectedTask.currentPhase]} · {selectedTask.currentAgentName ?? 'Unassigned'}
                  </div>
                </div>
              )}

              {selectedTask.status === 'in_progress' && (
                <div className="p-4 border-b border-dark-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">最后更新</div>
                      <div className="text-sm text-gray-300">{formatTime(selectedTask.updatedAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">状态</div>
                      {isTaskStagnant(selectedTask) ? (
                        <div className="text-sm text-yellow-400 flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                          </span>
                          停滞
                        </div>
                      ) : (
                        <div className="text-sm text-green-300 flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          进行中
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(selectedTask.iterationCount !== undefined || selectedTask.isInRework || (selectedTask.rejectionCount ?? 0) > 0 || selectedTask.lastReviewFeedback) && (
                <div className="p-4 border-b border-dark-100 bg-dark-100/10">
                  <div className="text-xs text-gray-500 mb-2">迭代信号</div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTask.iterationCount !== undefined && (
                      <span className="rounded-full border border-primary-500/30 bg-primary-500/10 px-2 py-1 text-xs text-primary-200">
                        第 {selectedTask.iterationCount} 轮
                      </span>
                    )}
                    {selectedTask.isInRework && (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
                        返工
                      </span>
                    )}
                    {(selectedTask.rejectionCount ?? 0) > 0 && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                        {selectedTask.rejectionCount} 次打回
                      </span>
                    )}
                  </div>
                  {selectedTask.lastReviewFeedback && (
                    <div className="text-sm text-gray-300">{selectedTask.lastReviewFeedback}</div>
                  )}
                </div>
              )}

              {selectedTask.lastApproved && selectedTask.iterationCount !== undefined && (
                <div className="p-4 border-b border-dark-100 bg-green-500/5">
                  <div className="text-xs text-gray-500 mb-1">审批状态</div>
                  <div className="text-sm text-green-300 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    第 {selectedTask.iterationCount} 轮 · 已通过
                  </div>
                </div>
              )}

              {(selectedTask.recentEvents ?? []).length > 0 && (
                <div className="p-4 border-b border-dark-100">
                  <div className="text-xs text-gray-500 mb-2">最近事件</div>
                  <div className="space-y-2">
                    {(selectedTask.recentEvents ?? []).slice(-3).map((event, idx) => {
                      const summary = summarizeEvent(event);
                      if (!summary) return null;
                      return (
                        <div key={idx} className="text-xs text-gray-400 flex items-center gap-2">
                          <span className="text-gray-500">{formatTime(event.timestamp)}</span>
                          <span className="text-gray-300">{summary.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedTask.failureSummary && (
                <div className="p-4 border-b border-dark-100 bg-red-500/5">
                  <div className="text-xs text-gray-500 mb-2">错误摘要</div>
                  <div className="text-sm text-red-300">{selectedTask.failureSummary}</div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedTask.phases.map((phase) => (
                  <div
                    key={phase.phase}
                    className={`rounded-xl border px-4 py-3 ${PHASE_STATUS_STYLES[phase.status]}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{phase.label}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Owner: {phase.agentName ?? '—'}
                        </div>
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-gray-300">{phase.status.replace('_', ' ')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs text-gray-400">
                      <div>
                        <div className="text-gray-500">Start</div>
                        <div>{formatTime(phase.startTime)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">End</div>
                        <div>{formatTime(phase.endTime)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8 text-center">
              <div>
                <div>没有任务可显示</div>
                <div className="text-xs text-gray-400 mt-1">请尝试其他筛选或添加新任务</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
