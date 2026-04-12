'use client';

import { useState, useCallback } from 'react';

import { GameEvent } from '@/game/types/GameEvents';

const AGENTS = [
  { id: 'pm-agent', name: 'PM' },
  { id: 'dev-agent', name: 'Dev' },
  { id: 'review-agent', name: 'Reviewer' },
  { id: 'test-agent', name: 'Tester' },
];

const STATUSES = ['idle', 'busy', 'working', 'offline'];
const EMOTIONS = ['neutral', 'focused', 'thinking', 'happy', 'stressed', 'celebrating', 'sleepy'];

const TEST_TASKS = [
  { label: 'Blog website (Next.js + Tailwind)', description: '写一个个人博客网站，包含首页、关于我、文章列表三个页面，使用 Next.js 和 Tailwind CSS' },
  { label: 'Unit tests for login module', description: '为用户登录模块编写单元测试，覆盖正常登录、密码错误、账户锁定三种场景' },
  { label: 'Review client.ts code quality', description: '审查 src/lib/gateway/client.ts 的代码质量，关注错误处理和资源释放' },
  { label: 'Implement /api/health endpoint', description: '实现一个 REST API 端点 /api/health，返回服务状态和当前时间' },
];

const RANDOM_TASKS = [
  '写一个 Todo List 应用，支持增删改查和本地存储',
  '实现一个 Markdown 编辑器组件，支持实时预览',
  '为购物车模块编写集成测试',
  '实现用户权限管理系统，支持角色分配',
];

interface ControlPanelProps {
  onSendEvent: (event: GameEvent) => void;
  onTriggerTask?: (taskId: string) => void;
}

export function ControlPanel({ onSendEvent, onTriggerTask }: ControlPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState('pm-agent');
  const [selectedStatus, setSelectedStatus] = useState('working');
  const [selectedEmotion, setSelectedEmotion] = useState('happy');
  const [taskDescription, setTaskDescription] = useState('');
  const [lastTask, setLastTask] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const handleSetStatus = useCallback(() => {
    onSendEvent({
      type: 'agent:status-change',
      timestamp: Date.now(),
      agentId: selectedAgent,
      status: selectedStatus as GameEvent['status' & keyof GameEvent] as 'idle' | 'busy' | 'working' | 'offline',
    } as GameEvent);
  }, [selectedAgent, selectedStatus, onSendEvent]);

  const handleAssignTask = useCallback(() => {
    onSendEvent({
      type: 'agent:task-assigned',
      timestamp: Date.now(),
      agentId: selectedAgent,
      taskId: `task-${Date.now()}`,
      taskType: 'manual',
      description: taskDescription || 'Manual task',
    });
  }, [selectedAgent, taskDescription, onSendEvent]);

  const handleChangeEmotion = useCallback(() => {
    onSendEvent({
      type: 'agent:emotion-change',
      timestamp: Date.now(),
      agentId: selectedAgent,
      emotion: selectedEmotion,
      source: 'manual',
    });
  }, [selectedAgent, selectedEmotion, onSendEvent]);

  const handleTriggerTask = useCallback(async (description?: string) => {
    if (isTriggering) return;

    const message = description ?? RANDOM_TASKS[Math.floor(Math.random() * RANDOM_TASKS.length)];
    setIsTriggering(true);
    setTriggerError(null);
    setLastTask(message);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        setTriggerError('触发失败，请重试');
        return;
      }

      const data = await res.json() as { taskId?: string; success?: boolean };
      const taskId = data.taskId ?? `task-${Date.now()}`;
      onTriggerTask?.(taskId);
    } catch {
      setTriggerError('网络错误，请重试');
    } finally {
      setIsTriggering(false);
    }
  }, [isTriggering, onTriggerTask]);

  return (
    <div>
      <h2 className="text-sm font-bold gradient-text mb-3">Control Panel</h2>

      {/* ── Quick Task Trigger (most prominent action) ─────────────────── */}
      <div className="mb-4 p-3 rounded-xl bg-primary-500/10 border border-primary-500/30">
        <p className="text-xs text-primary-300 font-medium mb-2">⚡ 触发任务 — 看 Agent 动起来</p>
        <div className="space-y-1.5">
          {TEST_TASKS.map(task => (
            <button
              key={task.label}
              onClick={() => handleTriggerTask(task.description)}
              disabled={isTriggering}
              className="w-full text-left px-2.5 py-2 bg-dark-50 hover:bg-primary-500/20 border border-dark-100 hover:border-primary-500/40 rounded-lg text-xs text-gray-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTriggering ? '⏳ 触发中...' : task.label}
            </button>
          ))}
          <button
            onClick={() => handleTriggerTask()}
            disabled={isTriggering}
            className="w-full text-left px-2.5 py-2 bg-dark-50 hover:bg-yellow-500/20 border border-dark-100 hover:border-yellow-500/40 rounded-lg text-xs text-yellow-400 hover:text-yellow-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTriggering ? '⏳ 触发中...' : '🎲 随机任务'}
          </button>
        </div>
        {triggerError && (
          <p className="mt-2 text-xs text-red-400">{triggerError}</p>
        )}
        {lastTask && !triggerError && (
          <p className="mt-2 text-xs text-gray-500 truncate">
            上次: <span className="text-gray-400">{lastTask}</span>
          </p>
        )}
      </div>

      {/* ── Manual event injection ──────────────────────────────────────── */}
      <p className="text-xs text-gray-500 mb-2 font-medium">手动控制 Agent</p>

      {/* Agent selector — shared across all actions */}
      <div className="mb-2">
        <label className="text-gray-500 text-xs block mb-1" htmlFor="agent-select">Agent</label>
        <select
          id="agent-select"
          aria-label="Agent"
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          className="w-full bg-dark-50 border border-dark-100 rounded-lg px-3 py-1.5 text-white text-sm"
        >
          {AGENTS.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Row 1: Status */}
      <div className="flex gap-2 mb-2">
        <select
          id="status-select"
          aria-label="Status"
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="flex-1 bg-dark-50 border border-dark-100 rounded-lg px-2 py-1.5 text-white text-xs"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={handleSetStatus}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          Set Status
        </button>
      </div>

      {/* Row 2: Task assign */}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          placeholder="Task description..."
          value={taskDescription}
          onChange={e => setTaskDescription(e.target.value)}
          className="flex-1 bg-dark-50 border border-dark-100 rounded-lg px-2 py-1.5 text-white text-xs min-w-0"
        />
        <button
          onClick={handleAssignTask}
          className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          Assign
        </button>
      </div>

      {/* Row 3: Emotion */}
      <div className="flex gap-2">
        <select
          id="emotion-select"
          aria-label="Emotion"
          value={selectedEmotion}
          onChange={e => setSelectedEmotion(e.target.value)}
          className="flex-1 bg-dark-50 border border-dark-100 rounded-lg px-2 py-1.5 text-white text-xs"
        >
          {EMOTIONS.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <button
          onClick={handleChangeEmotion}
          className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
        >
          Emotion
        </button>
      </div>
    </div>
  );
}
