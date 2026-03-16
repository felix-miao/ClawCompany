'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AgentConfig, defaultAgents } from '@/lib/agents/config'

interface Message {
  id: string
  agentId: string
  agentName: string
  emoji: string
  color: string
  content: string
  timestamp: Date
}

export default function TeamChatPage() {
  const [agents] = useState<AgentConfig[]>(defaultAgents)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)

  // 调用单个 Agent
  const callAgent = async (agent: AgentConfig, message: string) => {
    setCurrentAgent(agent.id)

    const response = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.id,
        userMessage: message,
        systemPrompt: agent.systemPrompt
      })
    })

    const result = await response.json()
    setCurrentAgent(null)

    if (result.success) {
      return result.message
    } else {
      throw new Error(result.error)
    }
  }

  // 添加消息到聊天
  const addMessage = (agent: AgentConfig, content: string) => {
    setMessages(prev => [...prev, {
      id: `${agent.id}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      emoji: agent.emoji,
      color: agent.color,
      content,
      timestamp: new Date()
    }])
  }

  // 主处理流程
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // 添加用户消息
    addMessage(
      { id: 'user', name: 'You', emoji: '👤', color: '#6B7280' } as any,
      userMessage
    )

    try {
      // 1. PM Agent 分析
      const pmAgent = agents.find(a => a.id === 'pm-agent')!
      addMessage(pmAgent, '正在分析需求...')
      
      const pmResponse = await callAgent(pmAgent, userMessage)
      
      // 更新 PM Agent 消息
      setMessages(prev => {
        const newMsgs = [...prev]
        const lastPmMsg = newMsgs.find(m => m.agentId === 'pm-agent' && m.content === '正在分析需求...')
        if (lastPmMsg) {
          lastPmMsg.content = pmResponse
        }
        return newMsgs
      })

      // 2. 调用 Dev Agent 实现（无论 PM 返回什么格式）
      const devAgent = agents.find(a => a.id === 'dev-agent')!
      addMessage(devAgent, '正在实现功能...')
      
      const devResponse = await callAgent(
        devAgent,
        `用户需求：${userMessage}\n\nPM 分析：${pmResponse}\n\n请实现这个功能，生成完整的代码。`
      )
      
      // 更新 Dev Agent 消息
      setMessages(prev => {
        const newMsgs = [...prev]
        const lastDevMsg = newMsgs.find(m => 
          m.agentId === 'dev-agent' && 
          m.content === '正在实现功能...'
        )
        if (lastDevMsg) {
          lastDevMsg.content = devResponse
        }
        return newMsgs
      })

      // 3. Review Agent 审查
      const reviewAgent = agents.find(a => a.id === 'review-agent')!
      addMessage(reviewAgent, '正在审查代码...')
      
      const reviewResponse = await callAgent(
        reviewAgent,
        `审查以下代码实现：\n\n用户需求：${userMessage}\n\n代码：\n${devResponse}`
      )
      
      // 更新 Review Agent 消息
      setMessages(prev => {
        const newMsgs = [...prev]
        const lastReviewMsg = newMsgs.find(m => 
          m.agentId === 'review-agent' && 
          m.content === '正在审查代码...'
        )
        if (lastReviewMsg) {
          lastReviewMsg.content = reviewResponse
        }
        return newMsgs
      })

      // 添加完成消息
      addMessage(
        { id: 'system', name: 'System', emoji: '🎉', color: '#FF5833' } as any,
        '团队协作完成！'
      )

    } catch (error) {
      console.error('Error:', error)
      addMessage(
        { id: 'error', name: 'Error', emoji: '❌', color: '#EF4444' } as any,
        `错误: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🦞 ClawCompany AI Team</h1>
            <p className="text-gray-400 text-sm">AI 虚拟团队协作系统 - E2E Demo</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Agent 状态 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600">
                  📋
                </div>
                <span className="text-sm">PM Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600">
                  💻
                </div>
                <span className="text-sm">Dev Agent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-600">
                  🔍
                </div>
                <span className="text-sm">Review Agent</span>
              </div>
            </div>
            
            <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
              返回首页
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex h-[calc(100vh-80px)]">
        {/* 聊天区域 */}
        <div className="flex-1 flex flex-col">
          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">开始和你的 AI 团队聊天吧！</p>
                <p className="text-sm">例如："帮我创建一个登录页面"</p>
              </div>
            )}
            
            {messages.map(msg => (
              <div key={msg.id} className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: msg.color }}
                >
                  {msg.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{msg.agentName}</span>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <pre className="whitespace-pre-wrap font-mono text-sm">{msg.content}</pre>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && !currentAgent && (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full" />
                <span>处理中...</span>
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="border-t border-gray-700 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="输入你的需求..."
                aria-label="输入你的需求"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                type="button"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg font-semibold transition-colors"
              >
                发送
              </button>
            </div>
          </div>
        </div>

        {/* Agent 配置侧边栏 */}
        <div className="w-80 border-l border-gray-700 p-6 overflow-y-auto">
          <h2 className="text-lg font-bold mb-4">团队成员</h2>
          
          {agents.map(agent => (
            <div 
              key={agent.id}
              className="mb-4 p-4 bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.emoji}
                </div>
                <span className="font-semibold">
                  {agent.role === 'pm' && '产品经理'}
                  {agent.role === 'dev' && '开发者'}
                  {agent.role === 'review' && '审查员'}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-2">
                {agent.role === 'pm' && '分析需求、拆分任务'}
                {agent.role === 'dev' && '实现功能'}
                {agent.role === 'review' && '代码审查'}
              </p>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Runtime: {agent.runtime}</div>
                {agent.agentId && <div>Agent ID: {agent.agentId}</div>}
                <div>Thinking: {agent.thinking}</div>
              </div>
            </div>
          ))}
          
          <button 
            className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => alert('添加自定义 Agent 功能即将推出！')}
          >
            + 添加 Agent
          </button>
          
          <div className="mt-6 p-4 bg-blue-900/30 rounded-lg">
            <h3 className="font-semibold text-blue-400 mb-2">💡 使用说明</h3>
            <p className="text-sm text-gray-400">
              输入你的需求，产品经理会分析并拆分任务，开发者会实现功能，审查员会审查代码。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
