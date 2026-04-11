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
    case 'task:handover':
      const toAgent = event.toAgentId?.includes('review') ? 'Reviewer'
        : event.toAgentId?.includes('test') ? 'Tester'
        : event.toAgentId?.includes('dev') ? 'Developer'
        : event.toAgentId ?? 'unknown';
      return { text: `交接给 ${toAgent}`, type: event.type };
    case 'task:progress':
      return { text: event.currentAction?.slice(0, 30) || '进行中', type: event.type };
    case 'task:completed':
      return { text: event.result === 'success' ? '完成' : `完成(${event.result})`, type: event.type };
    case 'task:failed':
      return { text: '失败', type: event.type };
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

function getTaskStatusLabel(task: TaskHistory): string {
  if (task.status === 'failed') return 'Failed';
  if (task.status === 'completed') return 'Done';
  return 'In Progress';
}

function getCurrentBlocker(task: TaskHistory): string {
  if (task.status !== 'in_progress') {
    return task.status === 'failed' ? '任务已失败，等待处理' : '任务已完成';
  }

  const lastEvent = (task.recentEvents ?? [])[(task.recentEvents ?? []).length - 1];
  if (lastEvent?.type === 'task:handover' && lastEvent.toAgentId) {
    const waitingOn = lastEvent.toAgentId.includes('review') ? 'Reviewer'
      : lastEvent.toAgentId.includes('test') ? 'Tester'
      : lastEvent.toAgentId.includes('dev') ? 'Developer'
      : lastEvent.toAgentId;
    return `等待 ${waitingOn} 处理`;
  }

  const phaseLabel = TASK_PHASE_LABELS[task.currentPhase];
  const owner = task.currentAgentName ?? 'Unassigned';
  return `${phaseLabel} · ${owner}`;
}

export function TraditionalTaskView({ tasks }: TraditionalTaskViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(tasks[0]?.taskId ?? null);

  useEffect(() => {
    if (!tasks.length) {
      setSelectedTaskId(null);
      return;
    }

    if (!selectedTaskId || !tasks.some(task => task.taskId === selectedTaskId)) {
      setSelectedTaskId(tasks[0].taskId);
    }
  }, [selectedTaskId, tasks]);

  const selectedTask = useMemo(
    () => tasks.find(task => task.taskId === selectedTaskId) ?? tasks[0] ?? null,
    [selectedTaskId, tasks]
  );

  if (!tasks.length || !selectedTask) {
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
        <div className="grid grid-cols-3 gap-2 w-full md:w-auto">
          <div className="rounded-xl border border-dark-100 bg-dark-50/40 px-3 py-2 text-center">
            <div className="text-xs text-gray-500">Running</div>
            <div className="text-lg font-semibold text-yellow-300">{tasks.filter(task => task.status === 'in_progress').length}</div>
          </div>
          <div className="rounded-xl border border-dark-100 bg-dark-50/40 px-3 py-2 text-center">
            <div className="text-xs text-gray-500">Done</div>
            <div className="text-lg font-semibold text-green-300">{tasks.filter(task => task.status === 'completed').length}</div>
          </div>
          <div className="rounded-xl border border-dark-100 bg-dark-50/40 px-3 py-2 text-center">
            <div className="text-xs text-gray-500">Failed</div>
            <div className="text-lg font-semibold text-red-300">{tasks.filter(task => task.status === 'failed').length}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] h-[calc(100%-5.5rem)] min-h-[460px]">
        <section className="rounded-xl border border-dark-100 bg-dark-50/30 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-dark-100 text-sm font-medium text-gray-200">Task List</div>
          <div className="overflow-y-auto p-2 space-y-2">
            {tasks.map((task) => (
              <button
                key={task.taskId}
                type="button"
                onClick={() => setSelectedTaskId(task.taskId)}
                className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                  selectedTaskId === task.taskId
                    ? 'border-primary-500/40 bg-primary-500/10'
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
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-dark-100 bg-dark-50/30 overflow-hidden flex flex-col min-h-0">
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
                  <div className="text-sm text-green-300 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    进行中
                  </div>
                </div>
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
                    <div className="text-sm font-medium text-white">
                      {phase.phase === 'done' && selectedTask.status === 'failed' ? 'Failed' : phase.label}
                    </div>
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
        </section>
      </div>
    </div>
  );
}
