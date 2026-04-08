import * as Phaser from 'phaser';

import { AgentCharacter, createAgent } from '../characters/AgentCharacter';
import { TILE_SIZE } from '../config/gameConfig';
import { DebugOverlay } from '../utils/DebugOverlay';
import { MovementSystem } from '../systems/MovementSystem';
import { AnimationController } from '../systems/AnimationController';
import { CharacterSpriteSystem } from '../sprites/CharacterSpriteSystem';
import { OfficeMapGenerator } from '../sprites/OfficeMapGenerator';
import { NavigationMesh } from '../data/NavigationMesh';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { NavigationSystem } from '../systems/NavigationSystem';
import { SceneEventBridge, SceneActions } from '../systems/SceneEventBridge';
import { EmotionType } from '../systems/EmotionSystem';
import { ParticleSystem, ParticleEffectType } from '../systems/ParticleSystem';
import { PerformanceMonitor } from '../systems/PerformanceMonitor';
import { MemoryManager } from '../systems/MemoryManager';
import { RenderOptimizer } from '../systems/RenderOptimizer';
import { ThrottleSystem } from '../systems/ThrottleSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { TargetMarker } from '../ui/TargetMarker';
import { OfficeDecorator } from '../ui/OfficeDecorator';
import { TaskManager } from '../systems/TaskManager';
import { TaskHandoverSystem } from '../systems/TaskHandoverSystem';
import { TaskFlowSystem } from '../systems/TaskFlowSystem';
import { TaskVisualizer } from '../ui/TaskVisualizer';
import { TaskHistoryPanel } from '../ui/TaskHistoryPanel';
import { TaskStatisticsPanel } from '../ui/TaskStatisticsPanel';
import { SmartTaskVisualizer, DisplayMode } from '../ui/SmartTaskVisualizer';
import { StatusAnimationSystem } from '../ui/StatusAnimationSystem';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { TutorialOverlay } from '../ui/TutorialOverlay';
import { InteractiveTutorial, InteractiveStepType } from '../ui/InteractiveTutorial';
import { OnboardingManager, OnboardingPhase } from '../systems/OnboardingManager';
import { EventBus } from '../systems/EventBus';
import { ShadowRenderer } from '../sprites/ShadowRenderer';
import { RoleVisuals } from '../sprites/RoleVisuals';
import type { RoomName, TaskType, Workstation, TilemapData, ActiveTask } from '../types/OfficeTypes';

import type { AgentConfig } from '../../types/agent-config';
export type { RoomName, TaskType, Workstation, TilemapData, ActiveTask } from '../types/OfficeTypes';

const AGENT_CONFIGS: AgentConfig[] = [
  { id: 'alice', name: 'Alice', role: 'Developer', emoji: '👩‍💻', color: '#ff6b6b', systemPrompt: '', runtime: 'subagent' },
  { id: 'bob', name: 'Bob', role: 'Developer', emoji: '👨‍💻', color: '#4ecdc4', systemPrompt: '', runtime: 'subagent' },
  { id: 'charlie', name: 'Charlie', role: 'Project Manager', emoji: '📋', color: '#45b7d1', systemPrompt: '', runtime: 'subagent' },
  { id: 'diana', name: 'Diana', role: 'Code Reviewer', emoji: '🔍', color: '#96ceb4', systemPrompt: '', runtime: 'subagent' },
];

export class OfficeScene extends Phaser.Scene {
  private agents: AgentCharacter[] = [];
  private agentMap: Map<string, AgentCharacter> = new Map();
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
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
  private performanceMonitor!: PerformanceMonitor;
  private memoryManager!: MemoryManager;
  private renderOptimizer!: RenderOptimizer;
  private throttleSystem!: ThrottleSystem;
  private lastOptimizationCheck: number = 0;
  private static readonly OPTIMIZATION_CHECK_INTERVAL = 5000;
  private static readonly MAX_PARTICLE_EMITTERS = 20;
  private static readonly STALE_EMITTER_AGE = 3000;
  private soundSystem!: SoundSystem;
  private targetMarker!: TargetMarker;
  private officeDecorator!: OfficeDecorator;
  private shadowRenderer!: ShadowRenderer;
  private roleVisuals!: RoleVisuals;
  private shadowGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private cachedShadowOffsetY: number = 0;
  private decorationGraphics: Phaser.GameObjects.Graphics[] = [];
  private virtualJoystick!: VirtualJoystick;
  private tutorialOverlay!: TutorialOverlay;
  private interactiveTutorial!: InteractiveTutorial;
  private onboardingManager!: OnboardingManager;
  private taskTimer: Phaser.Time.TimerEvent | null = null;
  private workstationTimer: Phaser.Time.TimerEvent | null = null;
  private eventBus!: EventBus;
  private taskManager!: TaskManager;
  private taskHandoverSystem!: TaskHandoverSystem;
  private taskFlowSystem!: TaskFlowSystem;
  private taskVisualizer!: TaskVisualizer;
  private historyPanel!: TaskHistoryPanel;
  private statisticsPanel!: TaskStatisticsPanel;
  private smartTaskVisualizer!: SmartTaskVisualizer;
  private statusAnimationSystem!: StatusAnimationSystem;
  private characterSpriteSystem!: CharacterSpriteSystem;
  private officeMapGenerator!: OfficeMapGenerator;

  private roomPositions: Record<string, { x: number; y: number }> = {
    'pm-office': { x: 350, y: 280 },
    'dev-studio': { x: 150, y: 400 },
    'test-lab': { x: 550, y: 400 },
    'review-center': { x: 650, y: 280 },
  };

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload(): void {
  }

  private getDefaultTilemapData(): TilemapData {
    return {
      width: 20,
      height: 15,
      tileSize: 32,
      workstations: [
        { id: 'ws1', x: 4, y: 8, label: 'Dev1', status: 'idle' as const, taskType: 'coding' },
        { id: 'ws2', x: 8, y: 8, label: 'Dev2', status: 'idle' as const, taskType: 'testing' },
        { id: 'ws3', x: 12, y: 8, label: 'PM', status: 'idle' as const, taskType: 'meeting' },
        { id: 'ws4', x: 16, y: 8, label: 'Review', status: 'idle' as const, taskType: 'review' },
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

  private createParticleTexture(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture('particle', 8, 8);
    graphics.destroy();

    const celebrationGraphics = this.add.graphics();
    celebrationGraphics.fillStyle(0xffffff, 1);
    celebrationGraphics.fillRect(0, 0, 6, 6);
    celebrationGraphics.lineStyle(1, 0xffdd00, 0.5);
    celebrationGraphics.strokeRect(0, 0, 6, 6);
    celebrationGraphics.generateTexture('particle-rect', 6, 6);
    celebrationGraphics.destroy();

    const errorGraphics = this.add.graphics();
    errorGraphics.fillStyle(0xff4444, 1);
    errorGraphics.fillCircle(3, 3, 3);
    errorGraphics.generateTexture('particle-error', 6, 6);
    errorGraphics.destroy();

    const sparkleGraphics = this.add.graphics();
    sparkleGraphics.fillStyle(0xffdd00, 1);
    sparkleGraphics.fillCircle(3, 3, 3);
    sparkleGraphics.generateTexture('particle-sparkle', 6, 6);
    sparkleGraphics.destroy();

    this.particleTextures.set('celebration', 'particle-rect');
    this.particleTextures.set('error', 'particle-error');
    this.particleTextures.set('task-complete', 'particle');
    this.particleTextures.set('work-start', 'particle');
    this.particleTextures.set('sparkle', 'particle-sparkle');
  }

  create(): void {
    try {
      console.log('🏢 创建虚拟办公室场景...');
      
      // 初始化角色精灵系统
      this.characterSpriteSystem = new CharacterSpriteSystem(this);
      // 初始化办公室地图生成器
      this.officeMapGenerator = new OfficeMapGenerator(this);
      this.createParticleTexture();
      
      // 生成增强的办公室地图
      this.generateEnhancedOfficeMap();

      this.platforms = this.physics.add.staticGroup();
      this.particleSystem = new ParticleSystem();
      this.performanceMonitor = new PerformanceMonitor({
        targetFPS: 60,
        sampleSize: 60,
        warningThreshold: 0.8,
        criticalThreshold: 0.5,
      });
      this.memoryManager = new MemoryManager({
        maxTrackedResources: 200,
        memoryBudgetMB: 10,
      });
      this.renderOptimizer = new RenderOptimizer({
        viewportWidth: Number(this.scale.width) || 800,
        viewportHeight: Number(this.scale.height) || 600,
        cullingMargin: 64,
        lodDistances: { near: 200, medium: 500, far: 800 },
      });
      this.throttleSystem = new ThrottleSystem();
      this.soundSystem = new SoundSystem();
      this.shadowRenderer = new ShadowRenderer();
      this.cachedShadowOffsetY = this.shadowRenderer.getShadowDimensions(32, 32).offsetY;
      this.roleVisuals = new RoleVisuals();
      this.officeDecorator = new OfficeDecorator();
      this.targetMarker = new TargetMarker(this);
      this.eventBus = new EventBus();
      this.taskManager = new TaskManager(this.eventBus);
      this.taskVisualizer = new TaskVisualizer(this, this.taskManager);
      this.historyPanel = new TaskHistoryPanel(this, this.taskManager.getHistoryStore());
      this.historyPanel.setPosition(10, 10);
      this.statisticsPanel = new TaskStatisticsPanel(this, this.taskManager.getStatisticsStore());
      this.statisticsPanel.setPosition(340, 10);
      
      // 初始化智能任务可视化系统
      this.smartTaskVisualizer = new SmartTaskVisualizer(this, this.taskManager, {
        maxDisplayDistance: 200,
        autoHideDelay: 5000,
        animationDuration: 300,
      });
      
      // 初始化状态动画系统
      this.statusAnimationSystem = new StatusAnimationSystem(this);
      this.particles = this.add.particles(0, 0, 'particle', {
        speed: { min: 20, max: 50 },
        scale: { start: 0.4, end: 0 },
        lifespan: 600,
        blendMode: 'ADD',
        frequency: -1,
        emitting: false,
      });
      
      this.createPlatforms();
      this.createDecorations();
      this.createNavigationMesh();
      this.createAgents();
      this.taskHandoverSystem = new TaskHandoverSystem(this.agentMap, this.eventBus);
      this.taskFlowSystem = new TaskFlowSystem(this, this.taskManager, this.eventBus);
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
      this.setupVirtualJoystick();
      
      console.log('✅ 虚拟办公室场景创建成功');
    } catch (error) {
      console.error('❌ 虚拟办公室场景创建失败:', error);
      this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 
        '场景加载失败，请刷新页面重试', {
          fontSize: '18px',
          color: '#ff4444',
          align: 'center'
        }).setOrigin(0.5);
    }
  }

  private generateEnhancedOfficeMap(): void {
    console.log('🗺️ 生成增强办公室地图...');
    
    // 生成办公室地图
    this.officeMapGenerator.generateOffice().then(officeData => {
      console.log('✅ 办公室地图生成完成');
      
      // 更新 tilemapData
      this.tilemapData = {
        width: 20,
        height: 15,
        tileSize: 32,
        workstations: officeData.workstations,
        platforms: officeData.platforms
      };
      
      // 创建背景
      this.officeMapGenerator.createOfficeBackground();
      
      // 创建装饰
      this.createEnhancedDecorations(officeData.decorations);
      
    }).catch(error => {
      console.warn('⚠️ 办公室地图生成失败，使用默认配置:', error);
      this.tilemapData = this.getDefaultTilemapData();
    });
  }

  private createEnhancedDecorations(decorations: any[]): void {
    console.log('🎨 创建增强装饰...');
    
    // 使用办公室装饰器创建装饰
    decorations.forEach(decoration => {
      const asset = this.officeMapGenerator.getDecorationAsset(decoration.type);
      
      if (asset) {
        const sprite = this.add.image(
          decoration.x * 32 + 16,
          decoration.y * 32 + 16,
          asset
        );
        sprite.setOrigin(0.5);
        sprite.setDepth(decoration.y + 1);
        this.decorationGraphics.push(sprite as any);
      }
    });
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
    this.taskTimer = this.time.addEvent({
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

    // 创建任务分配事件
    this.eventBus.emit('task:assigned', {
      type: 'task:assigned',
      agentId: agent.agentId,
      task: {
        id: `${agent.agentId}_${Date.now()}`,
        description: 'Office task',
        taskType: this.getRandomTaskType(),
      },
      timestamp: Date.now()
    });

    agent.moveTo(target.x, target.y);
    agent.setWorking(true);

    this.soundSystem.play('task-assigned');

    this.activeTasks.set(agent.agentId, {
      agentId: agent.agentId,
      targetX: target.x,
      targetY: target.y,
      returning: false,
    });

    // 启动任务进度
    const taskId = `${agent.agentId}_${Date.now()}`;
    this.eventBus.emit('task:progress', {
      type: 'task:progress',
      taskId: taskId,
      agentId: agent.agentId,
      progress: 0,
      currentAction: 'Starting task',
      timestamp: Date.now()
    });
  }

  private getRandomTaskType(): string {
    const taskTypes = ['coding', 'testing', 'meeting', 'review', 'design', 'debug', 'deploy', 'plan'];
    return taskTypes[Math.floor(Math.random() * taskTypes.length)];
  }

  private simulateTaskProgress(agentId: string): void {
    const progressInterval = setInterval(() => {
      const agent = this.agentMap.get(agentId);
      if (!agent || !agent.isWorkingState()) {
        clearInterval(progressInterval);
        return;
      }

      this.eventBus.emit('task:progress', {
        type: 'task:progress',
        taskId: `${agentId}_${Date.now()}`,
        agentId: agentId,
        progress: Math.random(),
        currentAction: 'Working on task',
        timestamp: Date.now()
      });
    }, 1000);
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
                
                // 发送任务完成事件
                this.eventBus.emit('task:completed', {
                  type: 'task:completed',
                  taskId: `${agentId}_${Date.now()}`,
                  agentId: agentId,
                  result: 'success',
                  duration: 5000,
                  timestamp: Date.now()
                });
                
                agent.setWorking(false);
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
            this.soundSystem.play('task-complete');
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
        this.soundSystem.play('tab-switch');
      }
    });

    this.input.keyboard!.on('keydown-D', () => {
      this.toggleDebug();
    });

    this.input.keyboard!.on('keydown-H', () => {
      if (this.historyPanel.isVisible()) {
        this.historyPanel.hide();
      } else {
        this.historyPanel.show();
      }
    });

    this.input.keyboard!.on('keydown-S', () => {
      if (this.statisticsPanel.isVisible()) {
        this.statisticsPanel.hide();
      } else {
        this.statisticsPanel.show();
      }
    });

    this.input.keyboard!.on('keydown-R', () => {
      this.reloadScene();
    });

    this.input.keyboard!.on('keydown-P', () => {
      this.performanceMonitor.printStats();
    });

    this.input.keyboard!.on('keydown-V', () => {
      // 切换可视化模式
      const currentMode = this.smartTaskVisualizer.getDisplayMode();
      const modes = ['compact', 'detailed', 'overview', 'focus'];
      const currentIndex = modes.indexOf(currentMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      this.smartTaskVisualizer.setDisplayMode(nextMode as any);
      this.soundSystem.play('click');
    });

    this.input.keyboard!.on('keydown-C', () => {
      // 切换选中状态
      if (this.selectedAgentIndex >= 0) {
        const selectedAgent = this.agents[this.selectedAgentIndex];
        this.smartTaskVisualizer.selectAgent(selectedAgent.agentId);
      } else {
        this.smartTaskVisualizer.deselectAgent();
      }
      this.soundSystem.play('click');
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const clickedAgent = this.findAgentNear(pointer.worldX, pointer.worldY, 40);
      if (clickedAgent) {
        const idx = this.agents.indexOf(clickedAgent);
        if (idx >= 0) {
          this.selectedAgentIndex = idx;
          this.movementSystem.setActiveAgent(clickedAgent);
          this.soundSystem.play('click');

          const task = this.taskManager.getTaskByAgent(clickedAgent.agentId);
          if (task) {
            this.taskVisualizer.showTaskDetailPanel(clickedAgent.agentId, task);
          } else {
            this.taskVisualizer.hideTaskDetailPanel();
          }
        }
      } else {
        const agent = this.agents[this.selectedAgentIndex];
        if (agent) {
          agent.moveTo(pointer.worldX, pointer.worldY);
          this.targetMarker.setTarget(pointer.worldX, pointer.worldY);
          this.soundSystem.play('click');
        }
        this.taskVisualizer.hideTaskDetailPanel();
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
      this.soundSystem.play('work-start');
    } else {
      this.soundSystem.play('work-end');
    }
  }

  private createPlatforms(): void {
    if (!this.tilemapData) return;

    // 使用角色精灵系统获取办公室资产
    const spriteSystem = this.characterSpriteSystem;

    this.tilemapData.platforms.forEach((platform) => {
      const x = platform.x * TILE_SIZE + (platform.width * TILE_SIZE) / 2;
      const y = platform.y * TILE_SIZE + (platform.height * TILE_SIZE) / 2;
      const width = platform.width * TILE_SIZE;
      const height = Math.max(platform.height * TILE_SIZE, 4);

      let assetType = 'floor';
      if (platform.type === 'desk') {
        assetType = 'desk';
      } else if (platform.type.includes('wall')) {
        assetType = 'wall';
      }

      const assetKey = spriteSystem.getOfficeAsset(assetType);
      
      // 创建平台精灵
      const platformSprite = this.platforms.create(x, y, assetKey);
      platformSprite.setOrigin(0.5, 0.5);
      
      // 根据平台类型调整大小
      if (assetType === 'desk') {
        platformSprite.setDisplaySize(width, height);
      } else {
        platformSprite.setDisplaySize(width, height);
      }
      
      platformSprite.refreshBody();

      // 添加平台装饰
      this.addPlatformDecoration(platform, x, y, width, height);
    });
  }

  private addPlatformDecoration(platform: any, x: number, y: number, width: number, height: number): void {
    // 为平台添加装饰效果
    if (platform.type === 'desk') {
      // 添加桌面装饰
      const decoration = this.add.graphics();
      decoration.fillStyle(0x8B4513, 0.3);
      decoration.fillRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8);
      decoration.lineStyle(2, 0x654321, 0.5);
      decoration.strokeRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8);
      decoration.setPosition(x, y);
      decoration.setDepth(1);
      this.decorationGraphics.push(decoration);
    } else if (platform.type.includes('wall')) {
      // 添加墙壁装饰
      const decoration = this.add.graphics();
      decoration.fillStyle(0xFFFFFF, 0.1);
      decoration.fillRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
      decoration.lineStyle(1, 0xDDDDDD, 0.3);
      decoration.strokeRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
      decoration.setPosition(x, y);
      decoration.setDepth(1);
      this.decorationGraphics.push(decoration);
    }
  }

  private createAgents(): void {
    if (!this.tilemapData) return;

    const agentColors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4];

    this.tilemapData.workstations.forEach((ws, index) => {
      const color = agentColors[index % agentColors.length];
      const config = AGENT_CONFIGS[index] ?? { id: ws.id, name: ws.label, role: ws.taskType };
      const badgeConfig = this.roleVisuals.getNameBadgeConfig(config.role);
      
      // 使用新的角色精灵系统
      const spriteSystem = this.characterSpriteSystem;
      const characterSprite = spriteSystem.getCharacterSprite(config.role);

      const x = ws.x * TILE_SIZE + TILE_SIZE / 2;
      const y = (ws.y - 1) * TILE_SIZE;
      
      // 使用增强的角色创建方法
      const agent = this.createEnhancedAgent(x, y, color, config, characterSprite);

      const controller = new AnimationController(agent, color);
      agent.setAnimationController(controller);

      agent.setPathfindingSystem(this.pathfindingSystem);

      this.agents.push(agent);
      this.agentMap.set(agent.agentId, agent);
      this.workstationMap.set(ws.id, ws);

      const nameLabel = this.add.text(x, y + 24, config.name, {
        fontSize: `${badgeConfig.fontSize}px`,
        color: badgeConfig.textColor,
        backgroundColor: `#${badgeConfig.bgColor.toString(16).padStart(6, '0')}`,
        padding: { x: badgeConfig.padding, y: 1 },
      });
      nameLabel.setOrigin(0.5);
      nameLabel.setStroke(`#${badgeConfig.borderColor.toString(16).padStart(6, '0')}`, 1);
      this.nameLabels.set(agent.agentId, nameLabel);

      // 创建增强的阴影
      const shadowDims = this.shadowRenderer.getShadowDimensions(64, 64);
      const shadowGfx = this.add.graphics();
      const shadowColor = this.shadowRenderer.getShadowColor();
      shadowGfx.fillStyle(shadowColor.color, shadowColor.alpha);
      shadowGfx.fillEllipse(0, 0, shadowDims.width, shadowDims.height);
      shadowGfx.setPosition(agent.x, agent.y + shadowDims.offsetY);
      this.shadowGraphics.set(agent.agentId, shadowGfx);

      // 添加角色特效标识
      this.addRoleIndicator(agent, config.role);

      this.memoryManager.track({
        type: 'text-label',
        id: `label_${agent.agentId}`,
        estimatedSize: 256,
      });
    });

    // 创建角色间互动
    this.createAgentInteractions();
  }

  private createEnhancedAgent(x: number, y: number, color: number, config: AgentConfig, characterSprite: string): AgentCharacter {
    // 使用角色精灵创建增强的角色
    const agent = new AgentCharacter(this, x, y, characterSprite, undefined, color, config);
    
    // 设置角色大小（64x64）
    agent.setDisplaySize(64, 64);
    agent.setOrigin(0.5, 1);
    
    // 设置物理属性
    agent.setCollideWorldBounds(true);
    agent.setBounce(0);
    agent.setDrag(800, 800);
    
    // 设置初始位置
    agent.setPosition(x, y);
    
    return agent;
  }

  private addRoleIndicator(agent: AgentCharacter, role: string): void {
    // 为角色添加角色标识
    let indicator = '';
    switch (role.toLowerCase()) {
      case 'project manager':
      case 'pm':
        indicator = '👔';
        break;
      case 'developer':
      case 'dev':
        indicator = '💻';
        break;
      case 'tester':
        indicator = '🔍';
        break;
      case 'reviewer':
        indicator = '📋';
        break;
      default:
        indicator = '👤';
    }
    
    const roleIndicator = this.add.text(agent.x, agent.y - 40, indicator, {
      fontSize: '20px',
    });
    roleIndicator.setOrigin(0.5);
    roleIndicator.setDepth(agent.depth + 2);
    
    // 保存引用以便更新位置
    (agent as any).roleIndicator = roleIndicator;
  }

  private createAgentInteractions(): void {
    // 创建角色间的互动效果
    this.time.addEvent({
      delay: 10000, // 每10秒检查一次
      callback: () => {
        this.checkAgentProximity();
      },
      loop: true,
    });
  }

  private checkAgentProximity(): void {
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        const agent1 = this.agents[i];
        const agent2 = this.agents[j];
        
        const distance = Phaser.Math.Distance.Between(agent1.x, agent1.y, agent2.x, agent2.y);
        
        if (distance < 80) {
          // 角色靠近时的互动效果
          this.createProximityEffect(agent1, agent2);
        }
      }
    }
  }

  private createProximityEffect(agent1: AgentCharacter, agent2: AgentCharacter): void {
    // 创建靠近时的特效
    const midX = (agent1.x + agent2.x) / 2;
    const midY = (agent1.y + agent2.y) / 2;
    
    const interactionGraphics = this.add.graphics();
    interactionGraphics.fillStyle(0x00ff00, 0.3);
    interactionGraphics.fillCircle(0, 0, 20);
    interactionGraphics.setPosition(midX, midY);
    interactionGraphics.setDepth(100);

    // 添加动画效果
    this.tweens.add({
      targets: interactionGraphics,
      alpha: 0,
      scale: 2,
      duration: 1000,
      onComplete: () => {
        interactionGraphics.destroy();
      }
    });
    
    // 播放互动音效
    this.soundSystem.play('click');
  }

  private setupInterAgentCollisions(): void {
    for (let i = 0; i < this.agents.length; i++) {
      for (let j = i + 1; j < this.agents.length; j++) {
        this.physics.add.collider(this.agents[i], this.agents[j]);
      }
    }
  }

  private setupWorkstationStatus(): void {
    this.workstationTimer = this.time.addEvent({
      delay: 3000,
      callback: () => {
        this.tilemapData?.workstations.forEach((ws) => {
          if (Math.random() > 0.7) {
            ws.status = ws.status === 'idle' ? 'busy' : 'idle';
            const agentIndex = this.tilemapData?.workstations.findIndex(w => w.id === ws.id) ?? -1;
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
    // 无重力模式：不再需要物理碰撞
    // Agent 使用 pathfinding 系统导航，不会穿过障碍物
    // 如果需要边界限制，可以在 Agent 的 update 中检查
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
        if (room in this.roomPositions) {
          this.moveAgentToRoom(agentId, room as RoomName);
        }
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

  private setupVirtualJoystick(): void {
    this.virtualJoystick = new VirtualJoystick(this, {
      x: this.cameras.main.width - 100,
      y: this.cameras.main.height - 100,
      radius: 80,
      knobRadius: 35,
      opacity: 0.7,
      autoShow: true,
      vibrateOnActive: true,
    });

    // 设置新手引导
    this.setupTutorial();
  }

  private setupTutorial(): void {
    this.onboardingManager = new OnboardingManager();

    this.onboardingManager.on('phase:complete', ({ phase }) => {
      console.log(`[Onboarding] Phase completed: ${phase}`);
    });
    this.onboardingManager.on('onboarding:complete', () => {
      console.log('[Onboarding] All phases completed!');
    });
    this.onboardingManager.on('achievement:unlock', (achievement) => {
      console.log(`[Onboarding] Achievement unlocked: ${achievement.icon} ${achievement.title}`);
    });

    const tutorialSteps = [
      {
        id: 'welcome-1',
        title: '欢迎来到虚拟办公室！',
        description: '在这里，AI 团队将协作完成各种任务。让我们开始学习如何使用这个系统。',
        phase: OnboardingPhase.WELCOME,
        type: InteractiveStepType.INFO,
        position: { x: this.cameras.main.width / 2, y: 100 },
      },
      {
        id: 'nav-move',
        title: '角色移动',
        description: '点击屏幕任意位置，角色会移动到该位置。你也可以使用 WASD 键控制。',
        phase: OnboardingPhase.NAVIGATION,
        type: InteractiveStepType.INTERACTION,
        position: { x: 200, y: 300 },
        interactionType: 'click',
        targetArea: { x: 100, y: 200, width: 300, height: 200 },
      },
      {
        id: 'task-view',
        title: '任务管理',
        description: '角色头上的气泡显示当前任务状态。点击角色可以查看任务详情。',
        phase: OnboardingPhase.TASKS,
        type: InteractiveStepType.INTERACTION,
        position: { x: 600, y: 300 },
        interactionType: 'click',
        targetArea: { x: 500, y: 200, width: 200, height: 100 },
      },
      {
        id: 'inter-joystick',
        title: '虚拟摇杆',
        description: '在移动设备上，可以使用右下角的虚拟摇杆控制角色移动。',
        phase: OnboardingPhase.INTERACTION,
        type: InteractiveStepType.HIGHLIGHT,
        position: { x: this.cameras.main.width - 150, y: this.cameras.main.height - 150 },
        targetArea: { x: this.cameras.main.width - 200, y: this.cameras.main.height - 200, width: 200, height: 200 },
      },
      {
        id: 'complete-finish',
        title: '开始协作！',
        description: '现在你已经了解了基本操作。让 AI 团队开始工作吧！',
        phase: OnboardingPhase.COMPLETE,
        type: InteractiveStepType.INFO,
        position: { x: this.cameras.main.width / 2, y: 100 },
      },
    ];

    this.interactiveTutorial = new InteractiveTutorial(this, {
      steps: tutorialSteps,
      onComplete: () => {
        this.onboardingManager.startPhase(OnboardingPhase.WELCOME);
        const phases = Object.values(OnboardingPhase);
        phases.forEach(phase => {
          this.onboardingManager.startPhase(phase);
          this.onboardingManager.completePhase(phase);
        });
        console.log('新手引导完成');
      },
      onStepComplete: (step) => {
        this.onboardingManager.recordStepResult({
          stepId: step.id,
          phase: step.phase,
          completed: true,
          timestamp: Date.now(),
        });
      },
    });

    if (this.onboardingManager.isFirstTime()) {
      this.time.delayedCall(2000, () => {
        this.interactiveTutorial.show();
      });
    } else {
      const oldTutorialSteps = [
        {
          title: '欢迎回来！',
          description: '你已经完成了新手引导。点击任意位置开始工作。',
          position: { x: this.cameras.main.width / 2, y: 100 },
        },
      ];

      this.tutorialOverlay = new TutorialOverlay(this, {
        title: '虚拟办公室',
        steps: oldTutorialSteps,
        skipButton: true,
        onComplete: () => {
          console.log('欢迎回来引导完成');
        },
      });

      this.time.delayedCall(1000, () => {
        this.tutorialOverlay.show();
      });
    }
  }

  getEventBridge(): SceneEventBridge | null {
    return this.eventBridge;
  }

  getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  private playParticleEffect(agentId: string, effectType: ParticleEffectType): void {
    if (this.particleEmitters.size >= OfficeScene.MAX_PARTICLE_EMITTERS) return;

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
    const emitterKey = `${agentId}_${effectType}_${Date.now()}`;
    this.particleEmitters.set(emitterKey, emitter);

    this.memoryManager.track({
      type: 'particle-emitter',
      id: emitterKey,
      estimatedSize: config.quantity * 64,
      destroy: () => emitter.destroy(),
    });

    this.time.delayedCall(config.lifespan + 200, () => {
      emitter.destroy();
      this.particleEmitters.delete(emitterKey);
      this.memoryManager.untrack(emitterKey);
    });
  }

  update(_time: number, delta: number): void {
    this.performanceMonitor.recordFrame(delta);

    const throttleLevel = this.performanceMonitor.getThrottleLevel();
    const shouldUpdateAll = throttleLevel < 0.3;

    if (shouldUpdateAll) {
      this.agents.forEach((agent) => agent.update());
    } else {
      const cameraX = this.cameras.main.scrollX;
      const cameraY = this.cameras.main.scrollY;
      this.agents.forEach((agent) => {
        const result = this.renderOptimizer.cull(
          { x: agent.x - 16, y: agent.y - 32, width: 32, height: 32 },
          cameraX, cameraY
        );
        if (result === 'visible') {
          agent.update();
        }
      });
    }

    this.syncNameLabels();
    this.syncShadows();
    this.syncTaskVisualizer();
    this.taskVisualizer.update();
    
    // 更新智能任务可视化系统
    this.smartTaskVisualizer.update();
    this.historyPanel.update();
    this.statisticsPanel.update();
    this.taskFlowSystem.update();
    this.movementSystem.update();
    this.debugOverlay.update(this.agents);
    this.checkTaskCompletion();
    this.particleSystem.update(delta);
    this.soundSystem.update(delta);

    const selectedAgent = this.agents[this.selectedAgentIndex];
    if (selectedAgent && this.targetMarker.isActive()) {
      this.targetMarker.updatePosition(selectedAgent.x, selectedAgent.y);
    }

    this.runOptimizationCheck();
  }

  private syncNameLabels(): void {
    this.nameLabels.forEach((label, agentId) => {
      const agent = this.agentMap.get(agentId);
      if (agent) {
        label.setPosition(agent.x, agent.y + 32);
        label.setDepth(agent.depth + 1);
        
        // 更新角色指示器位置
        const roleIndicator = (agent as any).roleIndicator;
        if (roleIndicator) {
          roleIndicator.setPosition(agent.x, agent.y - 40);
          roleIndicator.setDepth(agent.depth + 2);
        }
      }
    });
  }

  private syncShadows(): void {
    const offsetY = this.cachedShadowOffsetY;
    this.shadowGraphics.forEach((gfx, agentId) => {
      const agent = this.agentMap.get(agentId);
      if (agent) {
        gfx.setPosition(agent.x, agent.y + offsetY);
      }
    });
  }

  private syncTaskVisualizer(): void {
    this.agents.forEach((agent) => {
      this.taskVisualizer.updateAgentPosition(agent.agentId, agent.x, agent.y);
      // 更新智能任务可视化系统
      this.smartTaskVisualizer.updateAgentPosition(agent.agentId, agent.x, agent.y);
    });
  }

  getTaskManager(): TaskManager {
    return this.taskManager;
  }

  getTaskVisualizer(): TaskVisualizer {
    return this.taskVisualizer;
  }

  getHistoryPanel(): TaskHistoryPanel {
    return this.historyPanel;
  }

  getStatisticsPanel(): TaskStatisticsPanel {
    return this.statisticsPanel;
  }

  getTaskHandoverSystem(): TaskHandoverSystem {
    return this.taskHandoverSystem;
  }

  getSmartTaskVisualizer(): SmartTaskVisualizer {
    return this.smartTaskVisualizer;
  }

  getStatusAnimationSystem(): StatusAnimationSystem {
    return this.statusAnimationSystem;
  }

  getTaskFlowSystem(): TaskFlowSystem {
    return this.taskFlowSystem;
  }

  private createDecorations(): void {
    if (!this.tilemapData) return;

    this.officeDecorator.autoDecorate(
      this.tilemapData.platforms,
      this.tilemapData.width,
      this.tilemapData.height
    );

    const decorations = this.officeDecorator.getDecorations();
    for (const deco of decorations) {
      const gfx = this.add.graphics();
      OfficeDecorator.drawDecoration(gfx, deco.type, deco.config);
      gfx.setPosition(deco.x, deco.y);
      gfx.setDepth(deco.config.zIndex);
      gfx.setAlpha(0.85);
      this.decorationGraphics.push(gfx);

      this.memoryManager.track({
        type: 'decoration',
        id: deco.id,
        estimatedSize: deco.config.width * deco.config.height * 4,
      });
    }
  }

  toggleDebug(): void {
    this.physics.world.drawDebug = !this.physics.world.drawDebug;
  }

  reloadScene(): void {
    console.log('🔄 重新加载场景...');
    this.scene.restart();
  }

  moveToPosition(agentId: string, targetX: number, targetY: number): void {
    const agent = this.agentMap.get(agentId);
    if (!agent) return;

    agent.moveTo(targetX, targetY);
  }

  moveAgentToRoom(agentId: string, room: RoomName): void {
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

  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  getRenderOptimizer(): RenderOptimizer {
    return this.renderOptimizer;
  }

  private runOptimizationCheck(): void {
    const now = Date.now();
    if (now - this.lastOptimizationCheck < OfficeScene.OPTIMIZATION_CHECK_INTERVAL) return;
    this.lastOptimizationCheck = now;

    this.cleanupParticleEmitters();

    if (this.performanceMonitor.shouldThrottle()) {
      this.cleanupStaleMemory();
    }
  }

  private cleanupParticleEmitters(): void {
    const staleKeys: string[] = [];
    this.particleEmitters.forEach((emitter, key) => {
      if (!emitter.active) {
        staleKeys.push(key);
        emitter.destroy();
      }
    });
    staleKeys.forEach(k => this.particleEmitters.delete(k));

    if (this.particleEmitters.size > OfficeScene.MAX_PARTICLE_EMITTERS) {
      const entries = Array.from(this.particleEmitters.entries());
      const excess = entries.slice(0, this.particleEmitters.size - OfficeScene.MAX_PARTICLE_EMITTERS);
      for (const [key, emitter] of excess) {
        emitter.destroy();
        this.particleEmitters.delete(key);
      }
    }
  }

  private cleanupStaleMemory(): void {
    this.memoryManager.cleanupStale(OfficeScene.STALE_EMITTER_AGE);
  }

  shutdown(): void {
    if (this.taskTimer) {
      this.taskTimer.remove(false);
      this.taskTimer = null;
    }
    if (this.workstationTimer) {
      this.workstationTimer.remove(false);
      this.workstationTimer = null;
    }
    
    // 清理角色指示器（在清空数组之前）
    this.agents.forEach(agent => {
      const roleIndicator = (agent as any).roleIndicator;
      if (roleIndicator) {
        roleIndicator.destroy();
      }
    });
    
    this.soundSystem.stopAll();
    this.soundSystem.destroy();
    this.officeDecorator.destroy();
    this.taskFlowSystem.destroy();
    this.taskVisualizer.destroy();
    this.historyPanel.destroy();
    this.statisticsPanel.destroy();
    this.taskHandoverSystem.destroy();
    this.smartTaskVisualizer.destroy();
    this.statusAnimationSystem.clearAllAnimations();
    this.particleSystem.clearAllEffects();
    this.eventBridge?.disconnect();
    this.particleEmitters.forEach(e => e.destroy());
    this.particleEmitters.clear();
    this.shadowGraphics.forEach(g => g.destroy());
    this.shadowGraphics.clear();
    this.decorationGraphics.forEach(g => g.destroy());
    this.decorationGraphics = [];
    this.nameLabels.forEach(l => l.destroy());
    this.nameLabels.clear();
    this.activeTasks.clear();
    this.agents = [];
    this.agentMap.clear();
  }

  getSoundSystem(): SoundSystem {
    return this.soundSystem;
  }

  getOfficeDecorator(): OfficeDecorator {
    return this.officeDecorator;
  }
}
