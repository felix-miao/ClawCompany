# OpenClaw Orchestrator - Real Implementation

This directory contains the real OpenClaw orchestration logic that uses `sessions_spawn` to create AI agents.

## Architecture

**OpenClaw as the "Contractor" (包工头)**

```
User Request
     ↓
OpenClaw (Orchestrator)
     ├─→ Spawn PM Agent (subagent)
     ├─→ Spawn Dev Agent (acp/opencode)
     └─→ Spawn Review Agent (subagent)
```

## How It Works

1. User sends a request to OpenClaw
2. OpenClaw spawns PM Agent to analyze and plan
3. PM Agent returns task breakdown
4. For each task:
   - OpenClaw spawns Dev Agent (real OpenCode instance)
   - Dev Agent writes actual code
   - OpenClaw spawns Review Agent to check quality
   - If approved, move to next task
5. Return final result to user

## Files

- `orchestrator.ts` - Main orchestration logic
- `prompts/` - Agent prompts and configurations
- `examples/` - Example usage

## Status

🚧 **In Development** - This is the real implementation using OpenClaw's spawn capabilities.

The demo in `ai-team-demo/` shows a simulated version for presentation purposes.
