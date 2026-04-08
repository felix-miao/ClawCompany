'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { type AgentConfig, type AppAgentConfig, defaultAgents } from '@/lib/agents/config'

interface CodeFile {
  path: string
  language: string
  content: string
}

interface Message {
  id: string
  agentId: string
  agentName: string
  emoji: string
  color: string
  content: string
  timestamp: Date
  files?: CodeFile[]
}

type Mode = 'glm' | 'openclaw'

function parseCodeFiles(content: string): { text: string; files: CodeFile[] } {
  const files: CodeFile[] = []
  const codeBlockRegex = /(?:\*\*([^*]+\.\w+)\*\*\s*|)(```(\w+)?\n)([\s\S]*?)```/g
  let match
  const text = content

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const filePath = match[1] || ''
    const language = match[3] || 'text'
    const code = match[4]

    if (filePath) {
      files.push({
        path: filePath,
        language,
        content: code.trim()
      })
    }
  }

  return { text, files }
}

function MessageContent({ message }: { message: Message }) {
  const { files } = useMemo(() => parseCodeFiles(message.content), [message.content])
  const [activeFile, setActiveFile] = useState(0)
  const [showCode, setShowCode] = useState(false)

  if (message.agentId === 'dev-agent' && files.length > 0) {
    const textWithoutCode = message.content
      .replace(/(?:\*\*([^*]+\.\w+)\*\*\s*|)(```(\w+)?\n)([\s\S]*?)```/g, (match, filePath) => {
        return filePath ? `**${filePath}**\n` : ''
      })
      .replace(/### 创建的文件[\s\S]*?(?=###|$)/, '### 创建的文件\n\n')
      .trim()

    return (
      <div className="space-y-3">
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {textWithoutCode}
          </ReactMarkdown>
        </div>
        
        <div className="mt-3">
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
          >
            {showCode ? '▼ 隐藏代码' : '▶ 查看代码文件'}
            <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">{files.length}</span>
          </button>
          
          {showCode && (
            <div className="mt-2 border border-gray-700 rounded-lg overflow-hidden">
              <div className="flex border-b border-gray-700 overflow-x-auto">
                {files.map((file, index) => (
                  <button
                    key={file.path}
                    onClick={() => setActiveFile(index)}
                    className={`px-3 py-2 text-sm whitespace-nowrap ${
                      activeFile === index
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    📄 {file.path}
                  </button>
                ))}
              </div>
              <pre className="p-3 text-xs overflow-x-auto bg-gray-900 max-h-80">
                <code>{files[activeFile]?.content}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
  )
}

export default function TeamChatPage() {
  const [agents] = useState<AppAgentConfig[]>(defaultAgents)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('glm')
  const [openclawConnected, setOpenclawConnected] = useState<boolean | null>(null)

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

  const addMessage = (agent: AgentConfig, content: string) => {
    const { files } = parseCodeFiles(content)
    setMessages(prev => [...prev, {
      id: `${agent.id}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      emoji: agent.emoji || '🤖',
      color: agent.color || '#3b82f6',
      content,
      timestamp: new Date(),
      files: files.length > 0 ? files : undefined
    }])
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    const startTime = Date.now()

    addMessage(
      { id: 'user', name: 'You', role: 'user', emoji: '👤', color: '#6B7280', systemPrompt: '', runtime: 'subagent' },
      userMessage
    )

    try {
      const pmAgent = agents.find(a => a.id === 'pm-agent')!
      addMessage(pmAgent, '正在分析需求...')
      
      const pmStartTime = Date.now()
      const pmResponse = await callAgent(pmAgent, userMessage)
      const pmDuration = ((Date.now() - pmStartTime) / 1000).toFixed(1)
      
      const pmPlaceholder = '正在分析需求...'
      setMessages(prev => prev.map(m =>
        m.agentId === 'pm-agent' && m.content === pmPlaceholder
          ? { ...m, content: pmResponse + `\n\n⏱️ 用时：${pmDuration}秒` }
          : m
      ))

      const devAgent = agents.find(a => a.id === 'dev-agent')!
      addMessage(devAgent, '正在实现功能...')
      
      const devStartTime = Date.now()
      const devResponse = await callAgent(
        devAgent,
        `用户需求：${userMessage}\n\nPM 分析：${pmResponse}\n\n请实现这个功能，生成完整的代码。`
      )
      const devDuration = ((Date.now() - devStartTime) / 1000).toFixed(1)
      
      const devPlaceholder = '正在实现功能...'
      setMessages(prev => prev.map(m =>
        m.agentId === 'dev-agent' && m.content === devPlaceholder
          ? { ...m, content: devResponse + `\n\n⏱️ 用时：${devDuration}秒` }
          : m
      ))

      const reviewAgent = agents.find(a => a.id === 'review-agent')!
      addMessage(reviewAgent, '正在审查代码...')
      
      const reviewStartTime = Date.now()
      const reviewResponse = await callAgent(
        reviewAgent,
        `审查以下代码实现：\n\n用户需求：${userMessage}\n\n代码：\n${devResponse}`
      )
      const reviewDuration = ((Date.now() - reviewStartTime) / 1000).toFixed(1)
      
      const reviewPlaceholder = '正在审查代码...'
      setMessages(prev => prev.map(m =>
        m.agentId === 'review-agent' && m.content === reviewPlaceholder
          ? { ...m, content: reviewResponse + `\n\n⏱️ 用时：${reviewDuration}秒` }
          : m
      ))

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1)

      addMessage(
        { id: 'system', name: 'System', role: 'system', emoji: '🎉', color: '#FF5833', systemPrompt: '', runtime: 'subagent' },
        `团队协作完成！\n\n📊 性能统计：\n• PM Claw: ${pmDuration}秒\n• Dev Claw: ${devDuration}秒\n• Reviewer Claw: ${reviewDuration}秒\n• 总用时: ${totalDuration}秒`
      )

    } catch (error) {
      console.error('Error:', error)
      addMessage(
        { id: 'error', name: 'Error', role: 'error', emoji: '❌', color: '#EF4444', systemPrompt: '', runtime: 'subagent' },
        `错误: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🦞 ClawCompany AI Team</h1>
            <p className="text-gray-400 text-sm">AI 虚拟团队协作系统 - E2E Demo</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setMode('glm')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  mode === 'glm' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                GLM-5
              </button>
              <button
                onClick={() => setMode('openclaw')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  mode === 'openclaw' 
                    ? 'bg-orange-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                OpenClaw
              </button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-600">
                  📋
                </div>
                <span className="text-sm">PM Claw</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600">
                  💻
                </div>
                <span className="text-sm">Dev Claw</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-600">
                  🔍
                </div>
                <span className="text-sm">Reviewer Claw</span>
              </div>
            </div>
            
            <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
              返回首页
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex h-[calc(100vh-80px)]">
        <div className="flex-1 flex flex-col">
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{msg.agentName}</span>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    {msg.content === '正在分析需求...' || 
                     msg.content === '正在实现功能...' || 
                     msg.content === '正在审查代码...' ? (
                      <div className="flex items-center gap-2 text-gray-400">
                        <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                        <span>{msg.content}</span>
                      </div>
                    ) : (
                      <MessageContent message={msg} />
                    )}
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

          <div className="border-t border-gray-700 p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
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
            <p className="text-sm text-gray-400 mb-2">
              输入你的需求，产品经理会分析并拆分任务，开发者会实现功能，审查员会审查代码。
            </p>
            <div className="text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${mode === 'glm' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                <span>当前模式: {mode === 'glm' ? 'GLM-5 直接调用' : 'OpenClaw 集成'}</span>
              </div>
              {mode === 'openclaw' && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${openclawConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span>OpenClaw: {openclawConnected ? '已连接' : '未连接'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
