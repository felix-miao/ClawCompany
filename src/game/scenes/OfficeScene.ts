/**
 * OfficeScene — read-only display scene.
 *
 * Responsibilities:
 *  - Draw the office background (rooms, desks, grid)
 *  - Render one character sprite per agent at their room position
 *  - Reflect task state (idle / working) via animation
 *  - Allow clicking a character to show task detail
 *  - Expose the public API surface consumed by Game, SceneEventBridge, triggerTestTask
 *
 * Deliberately excluded: player movement, keyboard controls, physics platforms,
 * pathfinding, joystick, tutorial, sound, decorators, history/statistics panels.
 */
import * as Phaser from 'phaser';

import { AgentCharacter, createAgent } from '../characters/AgentCharacter';
import { AnimationController } from '../systems/AnimationController';
import { SceneEventBridge, SceneActions } from '../systems/SceneEventBridge';
import { EmotionType } from '../systems/EmotionSystem';
import { ParticleEffectType } from '../systems/ParticleSystem';
import { RoleVisuals } from '../sprites/RoleVisuals';
import { ShadowRenderer } from '../sprites/ShadowRenderer';
import { EventBus } from '../systems/EventBus';
import { TaskManager } from '../systems/TaskManager';
import { TaskVisualizer } from '../ui/TaskVisualizer';
import { TinyTownLoader } from '../sprites/TinyTownLoader';
import type { AgentConfig } from '../../types/agent-config';
import type { RoomName, TaskType, Workstation, TilemapData, ActiveTask } from '../types/OfficeTypes';

export type { RoomName, TaskType, Workstation, TilemapData, ActiveTask } from '../types/OfficeTypes';

// ── Agent definitions ────────────────────────────────────────────────────────
const AGENT_CONFIGS: AgentConfig[] = [
  { id: 'pm-agent',     name: 'PM',       role: 'Project Manager', emoji: '📋', color: '#45b7d1', systemPrompt: '', runtime: 'subagent' },
  { id: 'dev-agent',    name: 'Dev',      role: 'Developer',       emoji: '👨‍💻', color: '#4ecdc4', systemPrompt: '', runtime: 'subagent' },
  { id: 'review-agent', name: 'Reviewer', role: 'Code Reviewer',   emoji: '🔍', color: '#96ceb4', systemPrompt: '', runtime: 'subagent' },
  { id: 'test-agent',   name: 'Tester',   role: 'QA Engineer',     emoji: '🧪', color: '#ff6b6b', systemPrompt: '', runtime: 'subagent' },
];

// Short role key → texture / animation prefix registered by TinyTownLoader
const AGENT_ROLE_KEY: Record<string, string> = {
  'pm-agent':     'pm',
  'dev-agent':    'dev',
  'review-agent': 'reviewer',
  'test-agent':   'tester',
};

// ── Room layout (pixel coords, canvas 1200×700) ──────────────────────────────
// These must stay in sync with drawOfficeBackground().
const ROOM_CENTRES: Record<string, { x: number; y: number }> = {
  'pm-office':     { x: 200,  y: 220 },
  'dev-studio':    { x: 600,  y: 220 },
  'review-center': { x: 1000, y: 220 },
  'test-lab':      { x: 600,  y: 530 },
};

// Map agent id → room
const AGENT_ROOM: Record<string, string> = {
  'pm-agent':     'pm-office',
  'dev-agent':    'dev-studio',
  'review-agent': 'review-center',
  'test-agent':   'test-lab',
};

export class OfficeScene extends Phaser.Scene {
  // ── State ──────────────────────────────────────────────────────────────────
  private agents: AgentCharacter[] = [];
  private agentMap: Map<string, AgentCharacter> = new Map();
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private shadowGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private roleVisuals!: RoleVisuals;
  private shadowRenderer!: ShadowRenderer;
  private eventBridge: SceneEventBridge | null = null;
  private eventBus!: EventBus;
  private taskManager!: TaskManager;
  private taskVisualizer!: TaskVisualizer;
  private tilemapData: TilemapData | null = null;

  // Particle textures (minimal, for task-complete celebrations)
  private particleEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private static readonly MAX_PARTICLE_EMITTERS = 10;

  private static readonly PM_AGENT_ID = 'pm-agent';
  private static readonly TEST_TASKS = [
    '写一个个人博客网站，包含首页、关于我、文章列表三个页面，使用 Next.js 和 Tailwind CSS',
    '为用户登录模块编写单元测试，覆盖正常登录、密码错误、账户锁定三种场景',
    '审查 src/lib/gateway/client.ts 的代码质量，关注错误处理和资源释放',
    '组织迭代规划会议，讨论下一版本的功能优先级和排期',
    '实现一个 REST API 端点 /api/health，返回服务状态和当前时间',
  ];

  constructor() {
    super({ key: 'OfficeScene' });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  preload(): void {
    // Register all character + environment textures synchronously before create().
    new TinyTownLoader(this).preloadSync();
  }

  create(): void {
    const W = this.scale.width  || 1200;
    const H = this.scale.height || 700;

    this.roleVisuals   = new RoleVisuals();
    this.shadowRenderer = new ShadowRenderer();
    this.eventBus      = new EventBus();
    this.taskManager   = new TaskManager(this.eventBus);
    this.taskVisualizer = new TaskVisualizer(this, this.taskManager);

    // Build a minimal tilemapData so external callers have something to query
    this.tilemapData = this.buildTilemapData();

    this.createParticleTexture();
    this.drawOfficeBackground(W, H);
    this.createAgents();
    this.setupClickHandler();
    this.setupEventBridge();

    console.log('✅ OfficeScene (display-only) created');
  }

  update(): void {
    // Sync name labels and shadows to follow agent positions
    this.nameLabels.forEach((label, id) => {
      const agent = this.agentMap.get(id);
      if (agent) label.setPosition(agent.x, agent.y + 36);
    });
    this.shadowGraphics.forEach((gfx, id) => {
      const agent = this.agentMap.get(id);
      if (agent) gfx.setPosition(agent.x, agent.y + 8);
    });
    // Keep TaskVisualizer agent positions up-to-date so bubbles follow agents
    this.agentMap.forEach((agent, id) => {
      this.taskVisualizer.updateAgentPosition(id, agent.x, agent.y);
    });
    this.agents.forEach(a => a.update());
    this.taskVisualizer.update();
  }

  // ── Background ───────────────────────────────────────────────────────────────

  private drawOfficeBackground(W: number, H: number): void {
    // Dark floor + grid
    const floor = this.add.graphics();
    floor.fillStyle(0x1e2235, 1);
    floor.fillRect(0, 0, W, H);
    floor.lineStyle(1, 0x2a3050, 0.5);
    for (let x = 0; x <= W; x += 40) { floor.moveTo(x, 0); floor.lineTo(x, H); }
    for (let y = 0; y <= H; y += 40) { floor.moveTo(0, y); floor.lineTo(W, y); }
    floor.strokePath();
    floor.setDepth(-10);

    // Outer border
    const border = this.add.graphics();
    border.lineStyle(3, 0x4a5568, 1);
    border.strokeRect(2, 2, W - 4, H - 4);
    border.setDepth(-9);

    // Room definitions — keep centres in sync with ROOM_CENTRES
    const rooms = [
      { x: 60,  y: 60,  w: 280, h: 310, color: 0x1a3a4a, label: 'PM Office',     emoji: '📋', room: 'pm-office' },
      { x: 460, y: 60,  w: 280, h: 310, color: 0x1a3a2a, label: 'Dev Studio',    emoji: '💻', room: 'dev-studio' },
      { x: 860, y: 60,  w: 280, h: 310, color: 0x3a1a2a, label: 'Review Center', emoji: '🔍', room: 'review-center' },
      { x: 460, y: 400, w: 280, h: 250, color: 0x2a1a3a, label: 'Test Lab',      emoji: '🧪', room: 'test-lab' },
    ];

    const roomGfx = this.add.graphics();
    roomGfx.setDepth(-8);

    rooms.forEach(r => {
      roomGfx.fillStyle(r.color, 1);
      roomGfx.fillRect(r.x, r.y, r.w, r.h);
      roomGfx.lineStyle(2, 0x4a5580, 0.9);
      roomGfx.strokeRect(r.x, r.y, r.w, r.h);

      // Room label
      this.add.text(r.x + r.w / 2, r.y + 18, `${r.emoji} ${r.label}`, {
        fontSize: '14px', color: '#94a3b8', fontStyle: 'bold',
      }).setOrigin(0.5, 0).setDepth(-7);

      // Desk at centre-bottom of room
      const cx = ROOM_CENTRES[r.room].x;
      const cy = ROOM_CENTRES[r.room].y;
      const deskGfx = this.add.graphics();
      deskGfx.setDepth(-6);
      deskGfx.fillStyle(0x4a3728, 1);
      deskGfx.fillRect(cx - 52, cy + 24, 104, 22);
      deskGfx.lineStyle(1, 0x6b4f3a, 1);
      deskGfx.strokeRect(cx - 52, cy + 24, 104, 22);
      // Monitor
      deskGfx.fillStyle(0x1a1f2e, 1);
      deskGfx.fillRect(cx - 14, cy + 6, 28, 18);
      deskGfx.lineStyle(1, 0x45b7d1, 0.8);
      deskGfx.strokeRect(cx - 14, cy + 6, 28, 18);
      deskGfx.fillStyle(0x45b7d1, 0.18);
      deskGfx.fillRect(cx - 12, cy + 8, 24, 14);
    });

    // Corridor lines
    const corridors = this.add.graphics();
    corridors.setDepth(-9);
    corridors.lineStyle(1, 0x3a4060, 0.4);
    corridors.moveTo(340, 375); corridors.lineTo(460, 375);
    corridors.moveTo(740, 375); corridors.lineTo(860, 375);
    corridors.moveTo(600, 370); corridors.lineTo(600, 400);
    corridors.strokePath();
  }

  // ── Agents ───────────────────────────────────────────────────────────────────

  private createAgents(): void {
    AGENT_CONFIGS.forEach(config => {
      const room   = AGENT_ROOM[config.id];
      const centre = ROOM_CENTRES[room] ?? { x: 400, y: 300 };
      const roleKey = AGENT_ROLE_KEY[config.id] ?? 'pm';
      const textureKey = `character-${roleKey}`;
      const badge = this.roleVisuals.getNameBadgeConfig(config.role);

      const agent = new AgentCharacter(
        this, centre.x, centre.y, textureKey, undefined,
        parseInt((config.color ?? '#ffffff').replace('#', ''), 16), config,
      );
      agent.setDisplaySize(64, 64);
      agent.setOrigin(0.5, 0.5);
      agent.setDepth(10);
      agent.setCollideWorldBounds(true);
      // No gravity, no drag — agent sits still
      agent.setVelocity(0, 0);

      const ctrl = new AnimationController(agent, roleKey);
      agent.setAnimationController(ctrl);
      ctrl.forcePlay('idle');

      this.agents.push(agent);
      this.agentMap.set(agent.agentId, agent);

      // Shadow ellipse
      const shadow = this.add.graphics();
      const dims = this.shadowRenderer.getShadowDimensions(64, 64);
      const col  = this.shadowRenderer.getShadowColor();
      shadow.fillStyle(col.color, col.alpha);
      shadow.fillEllipse(0, 0, dims.width, dims.height);
      shadow.setPosition(centre.x, centre.y + 8);
      shadow.setDepth(9);
      this.shadowGraphics.set(agent.agentId, shadow);

      // Name badge
      const label = this.add.text(centre.x, centre.y + 36, config.name, {
        fontSize: `${badge.fontSize}px`,
        color: badge.textColor,
        backgroundColor: `#${badge.bgColor.toString(16).padStart(6, '0')}`,
        padding: { x: badge.padding, y: 2 },
      });
      label.setOrigin(0.5);
      label.setDepth(11);
      this.nameLabels.set(agent.agentId, label);
    });
  }

  // ── Click handler (read-only — shows task detail) ────────────────────────────

  private setupClickHandler(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const clicked = this.agents.find(a => {
        return Math.abs(a.x - pointer.worldX) < 36 && Math.abs(a.y - pointer.worldY) < 36;
      });
      if (!clicked) {
        this.taskVisualizer.hideTaskDetailPanel();
        return;
      }
      const task = this.taskManager.getTaskByAgent(clicked.agentId);
      if (task) {
        this.taskVisualizer.showTaskDetailPanel(clicked.agentId, task);
      } else {
        this.taskVisualizer.hideTaskDetailPanel();
      }
    });

    // Pointer-over cursor feedback
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const hovered = this.agents.some(a =>
        Math.abs(a.x - pointer.worldX) < 36 && Math.abs(a.y - pointer.worldY) < 36
      );
      this.game.canvas.style.cursor = hovered ? 'pointer' : 'default';
    });
  }

  // ── Event bridge ─────────────────────────────────────────────────────────────

  private setupEventBridge(): void {
    const actions: SceneActions = {
      setAgentWorking: (agentId, working) => {
        this.agentMap.get(agentId)?.setWorking(working);
      },
      moveAgentToRoom: (agentId, room) => {
        const target = ROOM_CENTRES[room];
        if (target) this.agentMap.get(agentId)?.tweenTo(target.x, target.y);
      },
      moveAgentToPosition: (agentId, x, y) => {
        this.agentMap.get(agentId)?.tweenTo(x, y);
      },
      setAgentEmotion: (agentId, emotion, duration) => {
        this.agentMap.get(agentId)?.setEmotion(emotion as EmotionType, duration);
      },
      getAgentStatus: (agentId) => {
        const a = this.agentMap.get(agentId);
        if (!a) return 'offline';
        return a.isWorkingState() ? 'busy' : 'idle';
      },
      triggerParticleEffect: (agentId, effectType) => {
        this.playParticleEffect(agentId, effectType);
      },
    };
    this.eventBridge = new SceneEventBridge(actions, undefined, this.eventBus);
    this.eventBridge.connect();
  }

  // ── Particles (minimal) ───────────────────────────────────────────────────────

  private createParticleTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x45b7d1, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle', 8, 8);
    g.destroy();
  }

  private playParticleEffect(agentId: string, _effectType: ParticleEffectType): void {
    if (this.particleEmitters.size >= OfficeScene.MAX_PARTICLE_EMITTERS) return;
    const agent = this.agentMap.get(agentId);
    if (!agent) return;
    if (!this.add) return;

    const emitter = this.add.particles(agent.x, agent.y - 20, 'particle', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.5, end: 0 },
      lifespan: 600,
      blendMode: Phaser.BlendModes.ADD,
      quantity: 12,
      emitting: false,
    });
    emitter.explode(12);
    const key = `${agentId}_${Date.now()}`;
    this.particleEmitters.set(key, emitter);
    this.time.delayedCall(800, () => {
      emitter.destroy();
      this.particleEmitters.delete(key);
    });
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private buildTilemapData(): TilemapData {
    return {
      width: this.scale?.width  || 1200,
      height: this.scale?.height || 700,
      tileSize: 1,
      workstations: AGENT_CONFIGS.map(c => {
        const room = AGENT_ROOM[c.id];
        const pos  = ROOM_CENTRES[room] ?? { x: 0, y: 0 };
        return { id: c.id, x: pos.x, y: pos.y, label: c.name, status: 'idle' as const, taskType: 'meeting' };
      }),
      platforms: [],
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  getEventBridge(): SceneEventBridge | null { return this.eventBridge; }
  getAgents(): AgentCharacter[] { return [...this.agents]; }
  getTaskManager(): TaskManager { return this.taskManager; }
  getTaskVisualizer(): TaskVisualizer { return this.taskVisualizer; }

  getAgentById(agentId: string): AgentCharacter | undefined {
    return this.agentMap.get(agentId);
  }

  moveAgentToRoom(agentId: string, room: RoomName): void {
    const pos = ROOM_CENTRES[room];
    if (pos) this.agentMap.get(agentId)?.moveTo(pos.x, pos.y);
  }

  moveToPosition(agentId: string, x: number, y: number): void {
    this.agentMap.get(agentId)?.moveTo(x, y);
  }

  assignTask(agentId: string, _taskType: TaskType): void {
    this.agentMap.get(agentId)?.setWorking(true);
  }

  triggerTestTask(description?: string): { agentId: string; description: string } | null {
    const pmAgent = this.agentMap.get(OfficeScene.PM_AGENT_ID);
    if (!pmAgent) return null;

    const taskDescription = description ??
      OfficeScene.TEST_TASKS[Math.floor(Math.random() * OfficeScene.TEST_TASKS.length)];

    const taskId = `test-${Date.now()}`;

    // Relay order: PM → Dev → Tester → Reviewer
    const relay: Array<{ agentId: string; room: string; label: string; durationMs: number }> = [
      { agentId: 'pm-agent',     room: 'pm-office',     label: 'PM 分析需求',   durationMs: 5_000 },
      { agentId: 'dev-agent',    room: 'dev-studio',    label: 'Dev 编码实现',  durationMs: 10_000 },
      { agentId: 'test-agent',   room: 'test-lab',      label: 'Tester 测试',   durationMs: 6_000 },
      { agentId: 'review-agent', room: 'review-center', label: 'Reviewer 审查', durationMs: 5_000 },
    ];

    // Helper: post to /api/game-events so sidebar DashboardStore gets it
    const postEvent = (body: object) => {
      fetch('/api/game-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {/* ignore */});
    };

    // Kick off each relay step with cumulative delay
    // Guard: this.time is undefined in Jest environment
    if (!this.time) {
      // In test env: just emit the first task:assigned immediately so tests can verify
      this.eventBus.emit({
        type: 'openclaw:send',
        timestamp: Date.now(),
        sessionKey: pmAgent.agentId,
        message: taskDescription,
        agentRole: 'pm',
      } as import('../types/GameEvents').OpenClawSendEvent);
      return { agentId: pmAgent.agentId, description: taskDescription };
    }

    let cumulativeDelay = 0;
    relay.forEach((step, idx) => {
      const agent = this.agentMap.get(step.agentId);
      if (!agent) return;

      // --- Step start ---
      this.time.delayedCall(cumulativeDelay, () => {
        const centre = ROOM_CENTRES[step.room];

        // Move agent back to their own room (they start there already, but
        // tween gives visual confirmation)
        agent.tweenTo(centre.x, centre.y);
        agent.setWorking(true);
        agent.setEmotion('focused' as EmotionType, 3000);
        this.playParticleEffect(step.agentId, 'work-start' as ParticleEffectType);

        // Register / update task in TaskManager for TaskVisualizer
        this.eventBus.emit('task:assigned', {
          type: 'task:assigned',
          agentId: step.agentId,
          task: { id: taskId, description: taskDescription, taskType: 'meeting' },
          timestamp: Date.now(),
        });

        // Sidebar sync
        postEvent({
          type: 'agent:status-change',
          agentId: step.agentId,
          status: 'busy',
          timestamp: Date.now(),
        });
        postEvent({
          type: 'agent:task-assigned',
          agentId: step.agentId,
          taskId,
          taskType: 'meeting',
          description: `[${step.label}] ${taskDescription}`,
          timestamp: Date.now(),
        });

        // Progress ticks: push 25 % increments during the step
        const ticks = 4;
        for (let t = 1; t <= ticks; t++) {
          this.time.delayedCall(step.durationMs * (t / (ticks + 1)), () => {
            const progress = Math.round((t / ticks) * 100);
            postEvent({
              type: 'task:progress',
              agentId: step.agentId,
              taskId,
              progress,
              currentAction: `${step.label} (${progress}%)`,
              timestamp: Date.now(),
            });
          });
        }
      });

      // --- Step end ---
      cumulativeDelay += step.durationMs;
      this.time.delayedCall(cumulativeDelay, () => {
        agent.setWorking(false);
        const emotion = idx === relay.length - 1 ? 'celebrating' : 'neutral';
        agent.setEmotion(emotion as EmotionType, 2000);
        if (idx === relay.length - 1) {
          this.playParticleEffect(step.agentId, 'task-complete' as ParticleEffectType);
        }

        postEvent({
          type: 'agent:status-change',
          agentId: step.agentId,
          status: 'idle',
          timestamp: Date.now(),
        });

        if (idx === relay.length - 1) {
          postEvent({
            type: 'agent:task-completed',
            agentId: step.agentId,
            taskId,
            result: 'success',
            duration: step.durationMs,
            timestamp: Date.now(),
          });
        }
      });
    });

    // Fire openclaw:send for the real gateway call
    this.eventBus.emit({
      type: 'openclaw:send',
      timestamp: Date.now(),
      sessionKey: pmAgent.agentId,
      message: taskDescription,
      agentRole: 'pm',
    } as import('../types/GameEvents').OpenClawSendEvent);

    return { agentId: pmAgent.agentId, description: taskDescription };
  }

   reloadScene(): void { this.scene.restart(); }
   toggleDebug(): void {}   // no-op in display mode

  /**
   * receiveGameEvent — bridge real Orchestrator GameEvents to character animations.
   *
   * Called by dashboard/page.tsx whenever the SSE stream delivers a relevant event.
   */
   receiveGameEvent(event: import('../types/GameEvents').GameEvent): void {
     switch (event.type) {
       case 'pm:analysis-complete': {
         const pm = this.agentMap.get('pm-agent');
         if (pm) {
           const c = ROOM_CENTRES['pm-office'];
           pm.tweenTo(c.x, c.y);
           pm.setWorking(true);
           pm.setEmotion('focused' as EmotionType, 3000);
           this.playParticleEffect('pm-agent', 'work-start' as ParticleEffectType);
         }
         break;
       }
       case 'dev:iteration-start': {
         const dev = this.agentMap.get('dev-agent');
         if (dev) {
           const c = ROOM_CENTRES['dev-studio'];
           dev.tweenTo(c.x, c.y);
           dev.setWorking(true);
           dev.setEmotion('focused' as EmotionType, 3000);
           this.playParticleEffect('dev-agent', 'work-start' as ParticleEffectType);
         }
         break;
       }
       case 'review:rejected': {
         const dev = this.agentMap.get('dev-agent');
         if (dev) dev.setEmotion('stressed' as EmotionType, 2000);
         const reviewer = this.agentMap.get('review-agent');
         if (reviewer) reviewer.setEmotion('focused' as EmotionType, 2000);
         break;
       }
       case 'workflow:iteration-complete': {
         const approved = event.payload?.approved;
         this.agentMap.forEach(agent => agent.setWorking(false));
         if (approved) {
           const reviewer = this.agentMap.get('review-agent');
           if (reviewer) {
             reviewer.setEmotion('celebrating' as EmotionType, 3000);
             this.playParticleEffect('review-agent', 'task-complete' as ParticleEffectType);
           }
         }
         break;
       }
       case 'agent:status-change': {
         const agent = this.agentMap.get(event.agentId ?? '');
         if (agent) {
           const busy = event.status === 'busy' || event.status === 'working';
           agent.setWorking(busy);
         }
         break;
       }
       default:
         break;
     }
   }

   // Shutdown cleanup
   shutdown(): void {
     this.eventBridge?.disconnect();
     this.game.canvas.style.cursor = 'default';
   }
}
