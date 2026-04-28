'use client';

import { useState, useCallback } from 'react';

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
  onTriggerTask?: (taskId: string) => void;
}

export function ControlPanel({ onTriggerTask }: ControlPanelProps) {
  const [lastTask, setLastTask] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

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

      <div className="mb-4 p-3 rounded-xl bg-primary-500/10 border border-primary-500/30">
        <p className="text-xs text-primary-300 font-medium mb-2">快速触发任务</p>
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
            {isTriggering ? '触发中...' : '随机任务'}
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

    </div>
  );
}
