import * as Phaser from 'phaser';
import { AgentCharacter } from '../characters/AgentCharacter';
import { TaskManager } from './TaskManager';
import { EventBus } from './EventBus';

export interface TaskFlowState {
  id: string;
  fromAgent: string;
  toAgent: string;
  taskType: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  duration: number;
}

export class TaskFlowSystem {
  private scene: Phaser.Scene;
  private taskManager: TaskManager;
  private eventBus: EventBus;
  private activeFlows: Map<string, TaskFlowState> = new Map();
  private flowGraphics: Map<string, Phaser.GameObjects.Container> = new Map();
  private flowAnimations: Map<string, Phaser.Tweens.Tween> = new Map();
  private particleEffects: Map<string, any> = new Map();

  constructor(scene: Phaser.Scene, taskManager: TaskManager, eventBus: EventBus) {
    this.scene = scene;
    this.taskManager = taskManager;
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on('task:assigned', (data: any) => {
      this.createTaskFlow(data);
    });

    this.eventBus.on('task:progress', (data: any) => {
      this.updateTaskFlow(data.taskId, 'in-progress', data.progress);
    });

    this.eventBus.on('task:completed', (data: any) => {
      this.updateTaskFlow(data.taskId, 'completed', 1);
      this.createCompletionEffect(data.taskId);
    });

    this.eventBus.on('task:failed', (data: any) => {
      this.updateTaskFlow(data.taskId, 'failed', 0);
      this.createFailureEffect(data.taskId);
    });
  }

  createTaskFlow(data: any): void {
    const flowId = `flow_${data.taskId}_${Date.now()}`;
    
    const flowState: TaskFlowState = {
      id: flowId,
      fromAgent: data.fromAgent,
      toAgent: data.toAgent,
      taskType: data.taskType,
      status: 'pending',
      progress: 0,
      startTime: Date.now(),
      duration: 5000 + Math.random() * 5000, // 5-10秒持续时间
    };

    this.activeFlows.set(flowId, flowState);
    this.createFlowVisualization(flowState);
    this.playFlowStartSound(flowState);
  }

  private createFlowVisualization(flow: TaskFlowState): void {
    // 获取角色位置
    const fromAgent = this.scene.children.list.find((child: any) => 
      child.agentId === flow.fromAgent
    ) as AgentCharacter;
    
    const toAgent = this.scene.children.list.find((child: any) => 
      child.agentId === flow.toAgent
    ) as AgentCharacter;

    if (!fromAgent || !toAgent) return;

    const fromX = fromAgent.x;
    const fromY = fromAgent.y - 20;
    const toX = toAgent.x;
    const toY = toAgent.y - 20;

    // 创建流动效果容器
    const flowContainer = this.scene.add.container(
      (fromX + toX) / 2,
      (fromY + toY) / 2
    );

    // 创建流动路径
    const flowLine = this.scene.add.graphics();
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);

    flowLine.lineStyle(3, 0x00ff00, 0.8);
    flowLine.lineBetween(-distance / 2, 0, distance / 2, 0);

    // 创建流动粒子
    const particles = this.scene.add.particles(0, 0, 'particle', {
      x: -distance / 2,
      y: 0,
      speed: { min: 100, max: 200 },
      scale: { start: 0.5, end: 0 },
      lifespan: 1000,
      gravityY: 0,
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Line(-distance / 2, 0, distance / 2, 0),
        quantity: 5,
        stepRate: 100,
      },
      emitting: true,
    });

    // 创建任务信息气泡
    const bubble = this.createTaskBubble(flow);
    bubble.setPosition(0, -30);

    flowContainer.add([flowLine, particles, bubble]);
    flowContainer.setDepth(100);

    this.flowGraphics.set(flow.id, flowContainer);

    // 添加流动动画
    const animation = this.scene.tweens.add({
      targets: particles,
      x: distance / 2,
      duration: flow.duration,
      ease: 'Linear',
      repeat: -1,
      onLoop: () => {
        particles.x = -distance / 2;
      }
    });

    this.flowAnimations.set(flow.id, animation);

    // 添加路径动画
    this.scene.tweens.add({
      targets: flowLine,
      alpha: { from: 0.8, to: 0.2 },
      duration: flow.duration,
      repeat: -1,
      yoyo: true,
    });

    // 任务完成后自动清理
    this.scene.time.delayedCall(flow.duration, () => {
      this.cleanupFlow(flow.id);
    });
  }

  private createTaskBubble(flow: TaskFlowState): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    
    // 背景
    const background = this.scene.add.graphics();
    background.fillStyle(0x000000, 0.8);
    background.fillRoundedRect(-40, -15, 80, 30, 10);
    background.lineStyle(2, 0x00ff00, 0.8);
    background.strokeRoundedRect(-40, -15, 80, 30, 10);

    // 任务文本
    const taskText = this.scene.add.text(0, -5, this.getTaskEmoji(flow.taskType), {
      fontSize: '16px',
    });
    taskText.setOrigin(0.5);

    // 状态文本
    const statusText = this.scene.add.text(0, 10, this.getStatusText(flow.status), {
      fontSize: '10px',
      color: this.getStatusColor(flow.status),
    });
    statusText.setOrigin(0.5);

    container.add([background, taskText, statusText]);
    container.setDepth(101);

    return container;
  }

  private getTaskEmoji(taskType: string): string {
    const emojiMap: Record<string, string> = {
      'coding': '💻',
      'testing': '🔍',
      'meeting': '👔',
      'review': '📋',
      'design': '🎨',
      'debug': '🐛',
      'deploy': '🚀',
      'plan': '📝',
    };
    return emojiMap[taskType] || '📋';
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待处理',
      'in-progress': '进行中',
      'completed': '已完成',
      'failed': '失败',
    };
    return statusMap[status] || status;
  }

  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      'pending': '#ffff00',
      'in-progress': '#00ff00',
      'completed': '#00ffff',
      'failed': '#ff0000',
    };
    return colorMap[status] || '#ffffff';
  }

  updateTaskFlow(flowId: string, status: 'pending' | 'in-progress' | 'completed' | 'failed', progress: number): void {
    const flow = this.activeFlows.get(flowId);
    if (!flow) return;

    flow.status = status;
    flow.progress = progress;

    const flowContainer = this.flowGraphics.get(flowId);
    if (flowContainer) {
      const bubble = flowContainer.list.find((child: any) => 
        child.list && child.list.length > 1
      ) as Phaser.GameObjects.Container;
      
      if (bubble) {
        const statusText = bubble.list.find((child: any) =>
          child.text && child.text === this.getStatusText(status)
        ) as Phaser.GameObjects.Text | undefined;
        if (statusText) {
          statusText.setText(this.getStatusText(status));
          statusText.setColor(this.getStatusColor(status));
        }
      }
    }

    // 更新进度动画
    if (progress > 0 && progress < 1) {
      this.updateProgressAnimation(flowId, progress);
    }
  }

  private updateProgressAnimation(flowId: string, progress: number): void {
    const flowContainer = this.flowGraphics.get(flowId);
    if (!flowContainer) return;

    const flowLine = flowContainer.list[0] as Phaser.GameObjects.Graphics;
    const particles = flowContainer.list[1] as Phaser.GameObjects.Particles.ParticleEmitter;

    // 更新流动线的宽度
    const width = 3 + progress * 2;
    flowLine.clear();
    flowLine.lineStyle(width, 0x00ff00, 0.8);

    // 更新粒子发射速率
    if (particles) {
      particles.frequency = 50 + progress * 150;
    }
  }

  private createCompletionEffect(flowId: string): void {
    const flow = this.activeFlows.get(flowId);
    if (!flow) return;

    const flowContainer = this.flowGraphics.get(flowId);
    if (!flowContainer) return;

    // 创建庆祝效果
    const celebrationParticles = this.scene.add.particles(
      flowContainer.x, 
      flowContainer.y, 
      'particle-sparkle', {
        speed: { min: 0, max: 100 },
        scale: { start: 0.5, end: 1.5 },
        lifespan: 1000,
        gravityY: -50,
        quantity: 20,
        emitting: true,
      }
    );

    // 添加闪光效果
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffffff, 0.8);
    flash.fillCircle(0, 0, 30);
    flash.setPosition(flowContainer.x, flowContainer.y);
    flash.setDepth(200);

    // 闪光动画
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 3,
      duration: 500,
      onComplete: () => {
        flash.destroy();
      }
    });

    // 庆祝音效
    this.playCompletionSound();

    // 1秒后清理粒子
    this.scene.time.delayedCall(1000, () => {
      celebrationParticles.destroy();
    });
  }

  private createFailureEffect(flowId: string): void {
    const flow = this.activeFlows.get(flowId);
    if (!flow) return;

    const flowContainer = this.flowGraphics.get(flowId);
    if (!flowContainer) return;

    // 创建失败效果
    const errorParticles = this.scene.add.particles(
      flowContainer.x, 
      flowContainer.y, 
      'particle-error', {
        speed: { min: 0, max: 150 },
        scale: { start: 0.3, end: 1 },
        lifespan: 800,
        gravityY: 50,
        quantity: 15,
        emitting: true,
      }
    );

    // 添加震动效果
    this.scene.cameras.main.shake(200, 0.005);

    // 失败音效
    this.playFailureSound();

    // 0.8秒后清理粒子
    this.scene.time.delayedCall(800, () => {
      errorParticles.destroy();
    });
  }

  private cleanupFlow(flowId: string): void {
    const flowContainer = this.flowGraphics.get(flowId);
    const animation = this.flowAnimations.get(flowId);

    if (animation) {
      animation.stop();
      animation.remove();
      this.flowAnimations.delete(flowId);
    }

    if (flowContainer) {
      this.scene.tweens.killTweensOf(flowContainer);
      flowContainer.destroy();
      this.flowGraphics.delete(flowId);
    }

    this.activeFlows.delete(flowId);
  }

  private playFlowStartSound(flow: TaskFlowState): void {
    // 根据任务类型播放不同的音效
    const soundMap: Record<string, string> = {
      'coding': 'task-coding',
      'testing': 'task-testing',
      'meeting': 'task-meeting',
      'review': 'task-review',
    };
    
    const soundKey = soundMap[flow.taskType] || 'task-general';
    this.scene.sound.play(soundKey, { volume: 0.3 });
  }

  private playCompletionSound(): void {
    this.scene.sound.play('task-complete', { volume: 0.5 });
  }

  private playFailureSound(): void {
    this.scene.sound.play('task-failed', { volume: 0.4 });
  }

  update(): void {
    // 更新所有活动中的任务流转
    this.activeFlows.forEach((flow, flowId) => {
      if (flow.status === 'in-progress') {
        const elapsed = Date.now() - flow.startTime;
        const newProgress = Math.min(elapsed / flow.duration, 1);
        
        if (newProgress > flow.progress) {
          this.updateTaskFlow(flowId, 'in-progress', newProgress);
        }
      }
    });
  }

  destroy(): void {
    // 清理所有流转效果
    this.activeFlows.forEach((_, flowId) => {
      this.cleanupFlow(flowId);
    });
    
    this.activeFlows.clear();
    this.flowGraphics.clear();
    this.flowAnimations.clear();
    this.particleEffects.clear();
  }

  getActiveFlows(): TaskFlowState[] {
    return Array.from(this.activeFlows.values());
  }

  getFlowProgress(flowId: string): number {
    const flow = this.activeFlows.get(flowId);
    return flow ? flow.progress : 0;
  }
}