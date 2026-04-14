import { render, screen } from '@testing-library/react'

import { SessionStatusPanel } from '../SessionStatusPanel'

import type { OpenClawSessionDetails } from '@/lib/gateway/openclaw-snapshot'

function createSession(overrides: Partial<OpenClawSessionDetails>): OpenClawSessionDetails {
  return {
    sessionKey: 'sess-1',
    agentId: 'dev-claw',
    agentName: 'Dev Claw',
    role: 'dev',
    label: '实现 dashboard session 分类',
    status: 'running',
    startedAt: '2026-04-14T05:00:00Z',
    endedAt: null,
    currentWork: '实现 session 状态面板',
    latestThought: '先补测试',
    latestResultSummary: '分类规则已就位',
    model: 'gpt-5.4',
    usage: undefined,
    latestMessage: '先补测试',
    latestMessageRole: 'assistant',
    latestMessageStatus: 'running',
    history: [],
    artifacts: [],
    category: 'running',
    ...overrides,
  }
}

describe('SessionStatusPanel', () => {
  it('renders all session categories with visible badges', () => {
    render(
      <SessionStatusPanel
        sessions={[
          createSession({ sessionKey: 'sess-running', category: 'running', agentName: 'PM Claw', label: '需求分析中' }),
          createSession({ sessionKey: 'sess-just-completed', category: 'just-completed', status: 'completed', agentName: 'Dev Claw', label: '刚完成实现' }),
          createSession({ sessionKey: 'sess-failed', category: 'failed', status: 'failed', agentName: 'Reviewer Claw', label: '审核失败' }),
          createSession({ sessionKey: 'sess-stuck', category: 'stuck', agentName: 'Tester Claw', label: '等待测试结果' }),
        ]}
      />,
    )

    expect(screen.getByText('Session Status')).toBeInTheDocument()
    expect(screen.getByText('PM Claw')).toBeInTheDocument()
    expect(screen.getByText('Dev Claw')).toBeInTheDocument()
    expect(screen.getByText('Reviewer Claw')).toBeInTheDocument()
    expect(screen.getByText('Tester Claw')).toBeInTheDocument()
    expect(screen.getByText(/running/)).toBeInTheDocument()
    expect(screen.getByText(/just-completed/)).toBeInTheDocument()
    expect(screen.getByText(/failed/)).toBeInTheDocument()
    expect(screen.getByText(/stuck/)).toBeInTheDocument()
  })

  it('returns null when there are no sessions', () => {
    const { container } = render(<SessionStatusPanel sessions={[]} />)

    expect(container.firstChild).toBeNull()
  })
})
