'use client';

import { useCallback } from 'react';

const TEST_TASKS = [
  { label: 'Blog website (Next.js + Tailwind)', description: '写一个个人博客网站，包含首页、关于我、文章列表三个页面，使用 Next.js 和 Tailwind CSS' },
  { label: 'Unit tests for login module', description: '为用户登录模块编写单元测试，覆盖正常登录、密码错误、账户锁定三种场景' },
  { label: 'Review client.ts code quality', description: '审查 src/lib/gateway/client.ts 的代码质量，关注错误处理和资源释放' },
  { label: 'Implement /api/health endpoint', description: '实现一个 REST API 端点 /api/health，返回服务状态和当前时间' },
];

interface ControlPanelProps {
  onTriggerTask?: (taskId: string) => void;
}

export function ControlPanel({ onTriggerTask }: ControlPanelProps) {
  const handleRefreshSnapshot = useCallback(() => {
    onTriggerTask?.('snapshot-refresh');
  }, [onTriggerTask]);

  return (
    <div>
      <h2 className="text-sm font-bold gradient-text mb-3">Control Panel</h2>

      <div className="mb-4 p-3 rounded-xl bg-primary-500/10 border border-primary-500/30">
        <p className="text-xs text-primary-300 font-medium mb-2">任务控制</p>
        <p className="mb-3 text-xs leading-5 text-gray-400">
          Dashboard 仅展示 OpenClaw snapshot。任务创建入口暂未接入 OpenClaw，已禁用，避免保留不会更新 Agent Status / Event Log / Timeline 的假交互。
        </p>
        <div className="space-y-1.5">
          {TEST_TASKS.map(task => (
            <button
              key={task.label}
              disabled
              title={task.description}
              className="w-full text-left px-2.5 py-2 bg-dark-50 border border-dark-100 rounded-lg text-xs text-gray-500 opacity-60 cursor-not-allowed"
            >
              {task.label}
            </button>
          ))}
          <button
            onClick={handleRefreshSnapshot}
            className="w-full text-left px-2.5 py-2 bg-dark-50 hover:bg-yellow-500/20 border border-dark-100 hover:border-yellow-500/40 rounded-lg text-xs text-yellow-400 hover:text-yellow-300 transition-all"
          >
            刷新 OpenClaw Snapshot
          </button>
        </div>
      </div>

    </div>
  );
}
