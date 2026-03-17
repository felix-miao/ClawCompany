# OpenClaw Gateway 集成指南

## 快速参考

### 1. Gateway 状态

**检查 Gateway 是否运行：**
```bash
openclaw gateway status
```

**健康检查：**
```bash
openclaw health
```

**查看 sessions:**
```bash
openclaw sessions list
```

---

### 2. Gateway API 禂要

**Base URL:** `http://127.0.0.1:18789`

**WebSocket 连接:**
- Endpoint: `ws://127.0.0.1:18789`
- 协议: Gateway Protocol
- 认证: 需要 token 或 password

**HTTP API:**
- Health: `GET http://127.0.0.1:18789/api/health`
- Sessions: `GET http://127.0.0.1:18789/api/sessions`

---

### 3. 集成步骤

**步骤 1: 安装依赖**
```bash
cd /Users/felixmiao/Projects/ClawCompany/ai-team-demo
npm install ws  # WebSocket client
# 或使用 fetch (支持 WebSocket)
```

**步骤 2: 创建 Gateway 客户端**
```typescript
// src/lib/openclaw/gateway-client.ts
import WebSocket from 'ws'

export class OpenClawGatewayClient {
  private ws: WebSocket
  private url: string
  private token?: string

  constructor(url: string = 'ws://127.0.0.1:18789', token?: string) {
    this.url = url
    this.token = token
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.on('open', () => {
        // 发送 connect 消息
        const connectMsg = {
          type: 'connect',
          token: this.token
        }
        this.ws.send(JSON.stringify(connectMsg))
      })

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'hello-ok') {
          resolve()
        } else if (msg.type === 'connect.challenge') {
          // 需要认证
          reject(new Error('Authentication required'))
        }
      })

      this.ws.on('error', reject)
    })
  }

  async spawnAgent(agentId: string, task: string): Promise<string> {
    const sessionId = `session-${Date.now()}`

    const spawnMsg = {
        type: 'req',
        method: 'sessions.spawn',
        params: {
          runtime: 'subagent',
          task: task,
          agentId: agentId,
          sessionId: sessionId
        }
    }

    this.ws.send(JSON.stringify(spawnMsg))

    return new Promise((resolve, reject) => {
    const handler = (data: Buffer) => {
      const msg = JSON.parse(data.toString())
      
      if (msg.type === 'res' && msg.method === 'sessions.spawn') {
        if (msg.status === 'ok') {
          resolve(msg.payload.sessionId)
        } else {
          reject(new Error(msg.error || 'Spawn failed'))
        }
        this.ws.off('message', handler)
      }
    }

    this.ws.on('message', handler)
  })
}
```

**步骤 3: 更新 API Route**
```typescript
// src/app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { OpenClawGatewayClient } from '@/lib/openclaw/gateway-client'

export async function POST(request: NextRequest) {
  const useOpenClaw = process.env.USE_OPENCLAW_GATEWAY === 'true'

  if (!useOpenClaw) {
    // 使用原有的 GLM-5 API
    return handleGLM5Request(request)
  }

  // 使用 OpenClaw Gateway
  const client = new OpenClawGatewayClient()
  await client.connect()

  const { agentId, userMessage } = await request.json()
  
  const sessionId = await client.spawnAgent(agentId, userMessage)
  
  return NextResponse.json({
    success: true,
    sessionId,
    message: 'Agent spawned successfully'
  })
}
```

