'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Message, Task } from '@/lib/agents/types'
import { sendMessage, getChatHistory } from '@/lib/api/client'

const agentConfig = {
  user: {
    name: 'You',
    avatar: '👤',
    color: 'bg-gray-600',
    borderColor: 'border-gray-500',
  },
  pm: {
    name: 'PM Agent',
    avatar: '📋',
    color: 'bg-blue-600',
    borderColor: 'border-blue-500',
  },
  dev: {
    name: 'Dev Agent',
    avatar: '💻',
    color: 'bg-green-600',
    borderColor: 'border-green-500',
  },
  review: {
    name: 'Review Agent',
    avatar: '🔍',
    color: 'bg-purple-600',
    borderColor: 'border-purple-500',
  },
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    // 加载初始状态
    loadInitialState()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadInitialState = async () => {
    const data = await getChatHistory()
    if (data.chatHistory) {
      setMessages(data.chatHistory)
    }
    if (data.tasks) {
      setTasks(data.tasks)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // 添加用户消息
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      agent: 'user',
      content: userMessage,
      type: 'text',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      // 发送到 API
      const response = await sendMessage(userMessage)
      
      if (response.success && response.chatHistory) {
        // 确保 timestamp 是 Date 对象
        const messagesWithDates = response.chatHistory.map((m: any) => ({
          ...m,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
        }))
        setMessages(messagesWithDates)
        if (response.tasks) {
          setTasks(response.tasks)
        }
      } else {
        // 显示错误
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          agent: 'pm',
          content: `❌ Error: ${response.error || 'Failed to process message'}`,
          type: 'text',
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMsg])
      }
    } catch (error) {
      console.error('Send error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col">
      {/* Header */}
      <header className="glass border-b border-dark-100 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              ← Back
            </Link>
            <div className="h-6 w-px bg-dark-100" />
            <h1 className="text-xl font-bold gradient-text">AI Team Chat</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['📋', '💻', '🔍'].map((emoji, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-dark-50 flex items-center justify-center border-2 border-dark text-sm">
                  {emoji}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              All agents active
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">No messages yet</p>
                <p className="text-gray-500 text-sm">Start a conversation with your AI team!</p>
              </div>
            )}
            
            {messages.map((message) => {
              const config = agentConfig[message.agent]
              const isUser = message.agent === 'user'
              
              return (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center text-lg shadow-lg border-2 ${config.borderColor} flex-shrink-0`}>
                    {config.avatar}
                  </div>
                  <div className={`max-w-[70%] ${isUser ? 'bg-primary-600/20 border-primary-500/30' : 'glass'} rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} px-4 py-3 border`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${isUser ? 'text-primary-400' : 'text-white'}`}>
                        {config.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              )
            })}
            
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-lg shadow-lg border-2 border-blue-500">
                  📋
                </div>
                <div className="glass rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-dark-100 p-4">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe what you want to build..."
                className="flex-1 bg-dark-50 border border-dark-100 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary-500 resize-none"
                rows={2}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-6 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Tasks Sidebar */}
        <div className="w-80 border-l border-dark-100 p-6 overflow-y-auto">
          <h2 className="text-lg font-bold text-white mb-4">Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No tasks yet</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="glass rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${
                      task.status === 'done' ? 'bg-green-500' :
                      task.status === 'in_progress' ? 'bg-yellow-500' :
                      task.status === 'review' ? 'bg-purple-500' :
                      'bg-gray-500'
                    }`} />
                    <span className="text-sm font-medium text-white">{task.title}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{task.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{task.assignedTo}</span>
                    <span>•</span>
                    <span>{task.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
