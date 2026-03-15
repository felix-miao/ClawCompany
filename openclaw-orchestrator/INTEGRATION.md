# Integration Guide: Web UI + OpenClaw Orchestrator

## Overview

The ClawCompany project has two modes:

1. **Demo Mode** (`ai-team-demo/`) - Simulated agent collaboration for presentation
2. **Real Mode** (`openclaw-orchestrator/`) - Actual OpenClaw-spawned agents

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User                                    │
│                   (Browser)                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP Request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js Web App (ai-team-demo)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Landing Page │  │  Chat Page   │  │  Task Dashboard  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                              │
│  Mode 1: Demo (simulated agents)                            │
│  Mode 2: Real (calls OpenClaw API)                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ OpenClaw API Call
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  OpenClaw (包工头)                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Orchestrator:                                       │    │
│  │  1. Receives user request                            │    │
│  │  2. Spawns PM Agent (subagent)                      │    │
│  │  3. Spawns Dev Agent (acp/opencode)                 │    │
│  │  4. Spawns Review Agent (subagent)                  │    │
│  │  5. Coordinates agents                               │    │
│  │  6. Returns result to web app                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Integration Options

### Option 1: WebSocket Communication

**Pros:**
- Real-time updates
- Bidirectional communication
- Good for live demo

**Implementation:**
1. OpenClaw exposes a WebSocket server
2. Next.js app connects to WebSocket
3. User request → WebSocket → OpenClaw → Orchestrator
4. Agent messages → WebSocket → Next.js → UI update

### Option 2: REST API + Polling

**Pros:**
- Simpler to implement
- No persistent connection
- Easier to debug

**Implementation:**
1. OpenClaw exposes REST endpoints:
   - `POST /api/orchestrate` - Start workflow
   - `GET /api/status/:id` - Get current status
2. Next.js app polls for updates
3. Display progress in real-time

### Option 3: Webhook Callbacks

**Pros:**
- No polling needed
- Event-driven
- Scalable

**Implementation:**
1. Next.js provides webhook URL
2. OpenClaw sends callbacks on events:
   - Agent spawned
   - Task started
   - Task completed
   - Message sent
3. Next.js updates UI on callbacks

## Recommended Approach for Demo

**Use Option 2 (REST API + Polling)** for the competition demo:

1. Simple to implement
2. Easy to understand
3. Reliable
4. Good enough for demo purposes

## API Design

### POST /api/orchestrate

**Request:**
```json
{
  "request": "创建一个登录页面",
  "projectPath": "/Users/felixmiao/Projects/ClawCompany",
  "mode": "real" // or "demo"
}
```

**Response:**
```json
{
  "workflowId": "wf-123",
  "status": "started",
  "estimatedTime": "2-5 minutes"
}
```

### GET /api/status/:workflowId

**Response:**
```json
{
  "workflowId": "wf-123",
  "status": "in_progress",
  "tasks": [
    {
      "id": "task-1",
      "title": "创建登录表单",
      "status": "done",
      "agent": "dev"
    },
    {
      "id": "task-2",
      "title": "添加表单验证",
      "status": "in_progress",
      "agent": "dev"
    }
  ],
  "messages": [
    {
      "agent": "pm",
      "content": "我已经分析了需求...",
      "timestamp": "2026-03-15T22:00:00Z"
    },
    {
      "agent": "dev",
      "content": "正在创建登录表单...",
      "timestamp": "2026-03-15T22:01:00Z"
    }
  ],
  "files": [
    {
      "path": "src/components/LoginForm.tsx",
      "content": "...",
      "generated": true
    }
  ]
}
```

## Next Steps

1. **Implement OpenClaw API endpoints** (in OpenClaw main session)
   - Create REST API handler
   - Connect to Orchestrator class
   - Add workflow tracking

2. **Update Next.js app**
   - Add mode toggle (demo vs real)
   - Implement API client
   - Add polling logic
   - Display real-time updates

3. **Testing**
   - Test with simple requests
   - Verify file generation
   - Check agent coordination

4. **Demo Preparation**
   - Prepare demo script
   - Test live demo flow
   - Have fallback to demo mode

## Competition Demo Strategy

For the competition, show both modes:

1. **Start with Demo Mode** (1 minute)
   - Show the concept
   - Explain the architecture
   - Quick overview

2. **Switch to Real Mode** (2 minutes)
   - Make a real request
   - Show agents spawning
   - Display live progress
   - Show generated files

3. **Highlight Innovation**
   - Real AI agents (not simulated)
   - OpenClaw as contractor
   - True team collaboration

## Status

- [x] Demo mode implemented
- [x] Orchestrator class created
- [ ] OpenClaw API endpoints
- [ ] Next.js integration
- [ ] End-to-end testing
- [ ] Demo script

**Estimated time to complete: 2-3 hours**
