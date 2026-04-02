import Phaser from 'phaser';
import { AgentCharacter, createAgent } from '../characters/AgentCharacter';
import type { AgentConfig } from '@/types/agent-config';
import { PHYSICS_CONFIG, TILE_SIZE } from '../config/gameConfig';
import { DebugOverlay } from '../utils/DebugOverlay';
import { MovementSystem } from '../systems/MovementSystem';
import { AnimationController } from '../systems/AnimationController';
import { CharacterSprites, createCharacterSprites } from '../sprites/CharacterSprites';
import { NavigationMesh } from '../data/NavigationMesh';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { NavigationSystem } from '../systems/NavigationSystem';
import { SceneEventBridge, SceneActions } from '../systems/SceneEventBridge';
import { EmotionType } from '../systems/EmotionSystem';
import { ParticleSystem, ParticleEffectType } from '../systems/ParticleSystem';

type TaskType = 'coding' | 'testing' | 'review' | 'meeting';

interface Workstation {
  id: string;
  x: number;
  y: number;
  label: string;
  status: 'idle' | 'busy';
  taskType: TaskType;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

interface TilemapData {
  width: number;
  height: number;
  tileSize: number;
  workstations: Workstation[];
  platforms: Platform[];
}

interface ActiveTask {
  agentId: string;
  targetX: number;
  targetY: number;
  returning: boolean;
}

const AGENT_CONFIGS: AgentConfig[] = [
  { id: 'dev1', name: 'Alice', role: 'Developer' },
  { id: 'dev2', name: 'Bob', role: 'Developer' },
  { id: 'pm', name: 'Charlie', role: 'Project Manager' },
  { id: 'reviewer', name: 'Diana', role: 'Code Reviewer' },
];

export class OfficeScene extends Phaser.Scene {
  private agents: AgentCharacter[] = [];
  private agentMap: Map<string, AgentCharacter> = new Map();
  private platforms: Phaser.Physics.Arcade.StaticGroup;
  private debugOverlay!: DebugOverlay;
  private movementSystem!: MovementSystem;
  private navigationSystem!: NavigationSystem;
  private tilemapData: TilemapData | null = null;
  private workstationMap: Map<string, Workstation> = new Map();
  private navMesh!: NavigationMesh;
  private pathfindingSystem!: PathfindingSystem;
  private activeTasks: Map<string, ActiveTask> = new Map();
  private selectedAgentIndex: number = 0;
  private nameLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eventBridge: SceneEventBridge | null = null;
  private particleSystem!: ParticleSystem;
  private particleEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private particleTextures: Map<string, string> = new Map();

  private roomPositions: Record<string, { x: number; y: number }> = {
    'pm-office': { x: 350, y: 280 },
    'dev-studio': { x: 150, y: 400 },
    'test-lab': { x: 550, y: 400 },
    'review-center': { x: 650, y: 280 },
  };

  constructor() {
    super({ key: 'OfficeScene' });
    this.platforms = this.physics.add.staticGroup();
  }

  async preload(): Promise<void> {
    this.createParticleTexture();

    try {
      const response = await fetch('/assets/office-tilemap.json');
      this.tilemapData = await response.json();
    } catch (error) {
      console.warn('Failed to load tilemap, using defaults');
      this.tilemapData = {
        width: 20,
        height: 15,
        tileSize: 32,
        workstations: [
          { id: 'ws1', x: 4, y: 8, label: 'Dev1', status: 'idle', taskType: 'coding' },
          { id: 'ws2', x: 8, y: 8, label: 'Dev2', status: 'idle', taskType: 'testing' },
          { id: 'ws3', x: 12, y: 8, label: 'PM', status: 'idle', taskType: 'meeting' },
          { id: 'ws4', x: 16, y: 8, label: 'Review', status: 'idle', taskType: 'review' },
        ],
        platforms: [
          { x: 0, y: 14, width: 20, height: 1, type: 'floor' },
          { x: 0, y: 0, width: 1, height: 14, type: 'wall_left' },
          { x: 19, y: 0, width: 1, height: 14, type: 'wall_right' },
          { x: 2, y: 9, width: 4, height: 0.5, type: 'desk' },
          { x: 6, y: 9, width: 4, height: 0.5, type: 'desk' },
          { x: 10, y: 9, width: 4, height: 0.5, type: 'desk' },
          { x: 14, y: 9, width: 4, height: 0.5, type: 'desk' },
        ],
      };
    }
  }

  private createParticleTexture(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();

    const celebrationGraphics = this.add.graphics();
    celebrationGraphics.fillStyle(0xffffff, 1);
    celebrationGraphics.fillRect(0, 0, 6, 6);
    celebrationGraphics.generateTexture('particle-rect', 6, 6);
    celebrationGraphics.destroy();

    const errorGraphics = this.add.graphics();
    errorGraphics.fillStyle(0xff4444, 1);
    errorGraphics.fillCircle(3, 3, 3);
    errorGraphics.generateTexture('particle-error', 6, 6);
    errorGraphics.destroy();

    const sparkleGraphics = this.add.graphics();
    sparkleGraphics.fillStyle(0xffdd00, 1);
    sparkleGraphics.fillCircle(2, 2, 2);
    sparkleGraphics.generateTexture('particle-sparkle', 4, 4);
    sparkleGraphics.destroy();

    this.particleTextures.set('celebration', 'particle-rect');
    this.particleTextures.set('error', 'particle-error');
    this.particleTextures.set('task-complete', 'particle');
    this.particleTextures.set('work-start', 'particle');
    this.particleTextures.set('sparkle', 'particle-sparkle');
  }

  create(): void {
    this.particleSystem = new ParticleSystem();
    this.particles = this.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.4, end: 0 },
      lifespan: 600,
      blendMode: 'ADD',
      frequency: -1,
      emitting: false,
    });
    this.createPlatforms();
    this.createNavigationMesh();
    this.createAgents();
    this.setupCollisions();
    this.setupDebug();
    this.setupWorkstationStatus();
    this.movementSystem = new MovementSystem(this);
    if (this.agents.length > 0) {
      this.movementSystem.setActiveAgent(this.agents[0]);
    }
    this.setupKeyboard();
    this.setupTaskSystem();
    this.setupEventBridge();
  }

  private createNavigationMesh(): void {
    if (!this.tilemapData) return;

    this.navMesh = NavigationMesh.fromTilemap({
      width: this.tilemapData.width,
      height: this.tilemapData.height,
      platforms: this.tilemapData.platforms,
    });

    this.pathfindingSystem = new PathfindingSystem(this, this.navMesh);
    this.navigationSystem = new NavigationSystem(this, this.navMesh);

    this.tilemapData.platforms.forEach((platform) => {
      if (platform.height <= 0.5) {
        this.navMesh.addPlatformNode(
          platform.x * TILE_SIZE + (platform.width * TILE_SIZE) / 2,
          platform.y * TILE_SIZE,
          platform.width * TILE_SIZE
        );
      }
    });
  }

  private setupTaskSystem(): void {
    this.time.addEvent({
      delay: 5000,
      callback: () => {
        this.triggerRandomTask();
      },
      loop: true,
    });
  }

  private triggerRandomTask(): void {
    if (this.agents.length === 0) return;

    const idleAgents = this.agents.filter(a => !this.activeTasks.has(a.agentId) && !a.isNavigatingToTarget());
    if (idleAgents.length === 0) return;

    const agent = idleAgents[Math.floor(Math.random() * idleAgents.length)];
    const targetPositions = [
      { x: 100, y: 400 },
      { x: 300, y: 400 },
      { x: 500, y: 400 },
      { x: 700, y: 400 },
      { x: 200, y: 250 },
      { x: 600, y: 250 },
    ];

    const target = targetPositions[Math.floor(Math.random() * targetPositions.length)];

    agent.moveTo(target.x, target.y);

    this.activeTasks.set(agent.agentId, {
      agentId: agent.agentId,
      targetX: target.x,
      targetY: target.y,
      returning: false,
    });
  }

  private checkTaskCompletion(): void {
    const completed: string[] = [];

    this.activeTasks.forEach((task, agentId) => {
      const agent = this.agentMap.get(agentId);
      if (!agent) {
        completed.push(agentId);
        return;
      }

      if (!task.returning) {
        const targetPos = agent.getTargetPosition();
        if (targetPos) {
          const dx = Math.abs(agent.x - targetPos.x);
          const dy = Math.abs(agent.y - targetPos.y);

          if (dx < 20 && dy < 20) {
            this.time.delayedCall(2000, () => {
              const t = this.activeTasks.get(agentId);
              if (t) {
                t.returning = true;
                agent.returnToOriginal();
              }
            });
          }
        }
      } else {
        const original = agent.getOriginalPosition();
        if (original) {
          const dx = Math.abs(agent.x - original.x);
          const dy = Math.abs(agent.y - original.y);

          if (dx < 20 && dy < 20) {
            completed.push(agentId);
          }
        }
      }
    });

    completed.forEach(id => this.activeTasks.delete(id));
  }

  private setupKeyboard(): void {
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.toggleActiveAgentWork();
    });

    this.input.keyboard!.on('keydown-TAB', () => {
      this.selectedAgentIndex = (this.selectedAgentIndex + 1) % this.agents.length;
      if (this.agents[this.selectedAgentIndex]) {
        this.movementSystem.setActiveAgent(this.agents[this.selectedAgentIndex]);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const clickedAgent = this.findAgentNear(pointer.worldX, pointer.worldY, 40);
      if (clickedAgent) {
        const idx = this.agents.indexOf(clickedAgent);
        if (idx >= 0) {
          this.selectedAgentIndex = idx;
          this.movementSystem.setActiveAgent(clickedAgent);
        }
      } else {
        const agent = this.agents[this.selectedAgentIndex];
        if (agent) {
          agent.moveTo(pointer.worldX, pointer.worldY);
        }
      }
    });
  }

  private findAgentNear(x: number, y: number, radius: number): AgentCharacter | null {
    for (const agent of this.agents) {
      const dx = Math.abs(agent.x - x);
      const dy = Math.abs(agent.y - y);
      if (dx < radius && dy < radius) {
        return agent;
      }
    }
    return null;
  }

  private toggleActiveAgentWork(): void {
    if (!this.movementSystem) return;
    const agent = this.agents[this.selectedAgentIndex];
    if (!agent) return;

    const isWorking = !agent.isWorkingState();
    agent.setWorking(isWorking);

    if (isWorking) {
      this.playParticleEffect(agent.agentId, 'work-start');
    }
  }

  private createPlatforms(): void {
    if (!this.tilemapData) return;

    const platformColors: Record<string, number> = {
      floor: 0x888888,
      wall_left: 0x666666,
      wall_right: 0x666666,
      desk: 0x4a3728,
    };

    this.tilemapData.platforms.forEach((platform) => {
      const x = platform.x * TILE_SIZE + (platform.width * TILE_SIZE) / 2;
      const y = platform.y * TILE_SIZE + (platform.height * TILE_SIZE) / 2;
      const width = platform.width * TILE_SIZE;
      const height = platform.height * TILE_SIZE;

      const graphics = this.add.graphics();
      graphics.fillStyle(platformColors[platform.type] || 0x888888, 1);
      graphics.fillRect(-width / 2, -height / 2, width, height);
      graphics.generateTexture(`platform_${platform.type}`, width, height);
      graphics.destroy();

      const platformSprite = this.platforms.create(x, y, `platform_${platform.type}`);
      platformSprite.setOrigin(0.5, 0.5);
      platformSprite.refreshBody();
    });
  }

  private createAgents(): void {
    if (!this.tilemapData) return;

    const agentColors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4];

    this.tilemapData.workstations.forEach((ws, index) => {
      const color = agentColors[index % agentColors.length];
      const config = AGENT_CONFIGS[index] ?? { id: ws.id, name: ws.label, role: ws.taskType };
      createCharacterSprites(this, color);

      const x = ws.x * TILE_SIZE + TILE_SIZE / 2;
      const y = (ws.y - 1) * TILE_SIZE;
      const agent = createAgent(this, x, y, color, config);

      const controller = new AnimationController(agent, color);
      agent.setAnimationController(controller);

      agent.setPathfindingSystem(this.pathfindingSystem);

      this.agents.push(agent);
      this.agentMap.set(agent.agentId, agent);
      this.workstationMap.set(ws.id, ws);

      const nameLabel = this.add.text(x, y + 20, config.name, {
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 2, y: 1 },
      });
      nameLabel.setOrigin(0.5);
      this.nameLabels.set(agent.agentId, nameLabel);
    });

    this.setupInterAgentCollisions();
  }

  private setupInterAgentCollisions(): void {
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        this.physics.add.collider(this.agents[i], this.agents[j]);
      }
    }
  }

  private setupWorkstationStatus(): void {
    this.time.addEvent({
      delay: 3000,
      callback: () => {
        this.tilemapData?.workstations.forEach((ws) => {
          if (Math.random() > 0.7) {
            ws.status = ws.status === 'idle' ? 'busy' : 'idle';
            const agentIndex = this.tilemapData!.workstations.findIndex(w => w.id === ws.id);
            if (agentIndex >= 0 && this.agents[agentIndex]) {
              this.agents[agentIndex].setWorking(ws.status === 'busy');
            }
          }
        });
      },
      loop: true,
    });
  }

  private setupCollisions(): void {
    this.agents.forEach((agent) => {
      this.physics.add.collider(agent, this.platforms);
    });
  }

  private setupDebug(): void {
    this.debugOverlay = new DebugOverlay(this);
  }

  private setupEventBridge(): void {
    const actions: SceneActions = {
      setAgentWorking: (agentId: string, working: boolean) => {
        const agent = this.agentMap.get(agentId);
        if (agent) agent.setWorking(working);
      },
      moveAgentToRoom: (agentId: string, room: string) => {
        this.moveAgentToRoom(agentId, room as any);
      },
      moveAgentToPosition: (agentId: string, x: number, y: number) => {
        this.moveToPosition(agentId, x, y);
      },
      setAgentEmotion: (agentId: string, emotion: string, duration?: number) => {
        const agent = this.agentMap.get(agentId);
        if (agent) agent.setEmotion(emotion as EmotionType, duration);
      },
      getAgentStatus: (agentId: string) => {
        const agent = this.agentMap.get(agentId);
        if (!agent) return 'offline';
        return agent.isWorkingState() ? 'busy' : 'idle';
      },
      triggerParticleEffect: (agentId: string, effectType: ParticleEffectType) => {
        this.playParticleEffect(agentId, effectType);
      },
    };

    this.eventBridge = new SceneEventBridge(actions);
    this.eventBridge.connect();
  }

  getEventBridge(): SceneEventBridge | null {
    return this.eventBridge;
  }

  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  private playParticleEffect(agentId: string, effectType: ParticleEffectType): void {
    const agent = this.agentMap.get(agentId);
    if (!agent) return;

    const config = this.particleSystem.getEffectConfig(effectType);
    if (!config) return;

    const texture = this.particleTextures.get(effectType) ?? 'particle';

    const emitter = this.add.particles(agent.x, agent.y - 20, texture, {
      speed: config.speed,
      scale: config.scale,
      lifespan: config.lifespan,
      gravityY: config.gravityY,
      alpha: config.alpha,
      tint: config.tints,
      quantity: config.quantity,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    emitter.explode(config.quantity);
    this.particleEmitters.set(`${agentId}_${effectType}_${Date.now()}`, emitter);

    this.time.delayedCall(config.lifespan + 200, () => {
      emitter.destroy();
    });
  }

  update(_time: number, delta: number): void {
    this.agents.forEach((agent) => agent.update());
    this.syncNameLabels();
    this.movementSystem.update();
    this.debugOverlay.update(this.agents);
    this.checkTaskCompletion();
    if (this.particleSystem) {
      this.particleSystem.update(delta);
    }
  }

  private syncNameLabels(): void {
    this.nameLabels.forEach((label, agentId) => {
      const agent = this.agentMap.get(agentId);
      if (agent) {
        label.setPosition(agent.x, agent.y + 24);
        label.setDepth(agent.depth + 1);
      }
    });
  }

  toggleDebug(): void {
    this.physics.world.drawDebug = !this.physics.world.drawDebug;
  }

  moveToPosition(agentId: string, targetX: number, targetY: number): void {
    const agent = this.agentMap.get(agentId);
    if (!agent) return;

    agent.moveTo(targetX, targetY);
  }

  moveAgentToRoom(agentId: string, room: 'pm-office' | 'dev-studio' | 'test-lab' | 'review-center'): void {
    const agent = this.agentMap.get(agentId);
    if (!agent) return;

    const roomPos = this.roomPositions[room];
    if (!roomPos) return;

    agent.moveTo(roomPos.x, roomPos.y);
  }

  assignTask(agentId: string, taskType: TaskType): void {
    const agent = this.agentMap.get(agentId);
    if (!agent) return;

    const workstation = this.findWorkstationByTaskType(taskType);
    if (!workstation) return;

    const worldX = workstation.x * TILE_SIZE + TILE_SIZE / 2;
    const worldY = (workstation.y - 1) * TILE_SIZE;

    agent.moveTo(worldX, worldY, () => {
      agent.setWorking(true);
    });
  }

  getAgentById(agentId: string): AgentCharacter | undefined {
    return this.agentMap.get(agentId);
  }

  getAgents(): AgentCharacter[] {
    return [...this.agents];
  }

  getSelectedAgent(): AgentCharacter | undefined {
    return this.agents[this.selectedAgentIndex];
  }

  private findWorkstationByTaskType(taskType: TaskType): Workstation | undefined {
    return this.tilemapData?.workstations.find(ws => ws.taskType === taskType);
  }
}
