import * as Phaser from 'phaser';

import { PHYSICS_CONFIG } from '../config/gameConfig';
import { AnimationController, AnimationState } from '../systems/AnimationController';
import { PathfindingSystem, PathPoint } from '../systems/PathfindingSystem';
import { EmotionSystem, EmotionType } from '../systems/EmotionSystem';

import type { AgentConfig } from '../../types/agent-config';

type NavigationState = 'idle' | 'moving' | 'jumping' | 'arrived';

// 扩展AgentCharacter类以包含emoji属性
declare module './AgentCharacter' {
  interface AgentCharacter {
    emojiText?: Phaser.GameObjects.Text;
  }
}

export class AgentCharacter extends Phaser.Physics.Arcade.Sprite {
  private isOnFloor: boolean = false;
  private animationController!: AnimationController;
  private color: number;
  private isWorking: boolean = false;
  private pathfindingSystem: PathfindingSystem | null = null;
  private targetPosition: { x: number; y: number } | null = null;
  private originalPosition: { x: number; y: number } | null = null;
  private isNavigating: boolean = false;
  private arrivalThreshold: number = 10;
  private navigationState: NavigationState = 'idle';
  private currentPath: PathPoint[] = [];
  private currentPathIndex: number = 0;
  private arrivalCallback: (() => void) | null = null;
  private onArrivalCallbacks: (() => void)[] = [];
  private emotionSystem: EmotionSystem;
  private emotionBubble: Phaser.GameObjects.Container | null = null;
  readonly agentConfig: AgentConfig;
  
  private lastVelocityX: number = 0;
  private lastVelocityY: number = 0;
  private squashTween: Phaser.Tweens.Tween | null = null;
  private wobbleTween: Phaser.Tweens.Tween | null = null;
  private bounceTween: Phaser.Tweens.Tween | null = null;
  private isMoving: boolean = false;
  private moveSpeed: number = 200;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    frame?: string | number,
    color: number = 0xffffff,
    config?: AgentConfig
  ) {
    super(scene, x, y, texture, frame);

    this.color = color;
    this.emotionSystem = new EmotionSystem();
    this.agentConfig = config ?? { id: `agent_${Date.now()}`, name: 'Agent', role: 'general' };
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 无重力模式：只限制在世界边界内，不应用重力
    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setDrag(PHYSICS_CONFIG.drag, PHYSICS_CONFIG.drag);
  }

  get agentId(): string {
    return this.agentConfig.id;
  }

  get agentName(): string {
    return this.agentConfig.name;
  }

  get agentRole(): string {
    return this.agentConfig.role;
  }

  setAnimationController(controller: AnimationController): void {
    this.animationController = controller;
  }

  update(): void {
    const velocityX = this.body?.velocity.x || 0;
    const velocityY = this.body?.velocity.y || 0;
    
    const isMovingNow = Math.abs(velocityX) > 10 || Math.abs(velocityY) > 10;
    
    if (isMovingNow && !this.isMoving) {
      this.playMoveStartAnimation();
    } else if (!isMovingNow && this.isMoving) {
      this.playMoveEndAnimation();
    }
    this.isMoving = isMovingNow;
    
    if (isMovingNow) {
      this.updateMovementAnimation(velocityX, velocityY);
    }

    if (this.animationController) {
      this.animationController.update(
        velocityX,
        velocityY,
        true,
        this.isWorking
      );
    }

    this.updateEmotionBubble();
    this.updateEmojiPosition();

    if (this.isNavigating) {
      this.updateNavigation();
    }
  }
  
  private updateMovementAnimation(velocityX: number, velocityY: number): void {
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    const stretchAmount = Math.min(speed / this.moveSpeed * 0.15, 0.15);
    
    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      this.setScale(1 + stretchAmount, 1 - stretchAmount * 0.5);
    } else {
      this.setScale(1 - stretchAmount * 0.5, 1 + stretchAmount);
    }
    
    if (!this.bounceTween) {
      this.bounceTween = this.scene.tweens.add({
        targets: this,
        scaleY: '+=0.02',
        duration: 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  
  private playMoveStartAnimation(): void {
    this.squashTween?.destroy();
    this.squashTween = this.scene.tweens.add({
      targets: this,
      scaleX: 0.8,
      scaleY: 1.2,
      duration: 80,
      ease: 'Quad.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Elastic.out',
        });
      },
    });
  }
  
  private playMoveEndAnimation(): void {
    this.squashTween?.destroy();
    this.bounceTween?.destroy();
    this.bounceTween = null;
    
    this.squashTween = this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 0.9,
      duration: 80,
      ease: 'Quad.out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: 1,
          scaleY: 1,
          duration: 120,
          ease: 'Elastic.out',
        });
      },
    });
  }

  private updateEmojiPosition(): void {
    const emojiText = (this as any).emojiText;
    if (emojiText) {
      const size = 64;
      emojiText.setPosition(this.x, this.y - size / 2);
    }
  }

  getOnFloor(): boolean {
    return this.body?.blocked.down || this.body?.touching.down || false;
  }

  setWorking(working: boolean): void {
    this.isWorking = working;
  }

  isWorkingState(): boolean {
    return this.isWorking;
  }

  setPathfindingSystem(system: PathfindingSystem): void {
    this.pathfindingSystem = system;
  }

  moveTo(targetX: number, targetY: number, onArrival?: () => void): void {
    if (!this.pathfindingSystem) return;

    if (!this.originalPosition) {
      this.originalPosition = { x: this.x, y: this.y };
    }

    const path = this.pathfindingSystem.findPath(this.x, this.y, targetX, targetY);
    this.currentPath = path;
    this.currentPathIndex = 0;
    this.targetPosition = { x: targetX, y: targetY };
    this.isNavigating = true;
    this.navigationState = 'moving';

    if (onArrival) {
      this.arrivalCallback = onArrival;
    }
  }

  private updateNavigation(): void {
    if (!this.isNavigating || this.currentPath.length === 0) return;

    const nextPoint = this.currentPath[this.currentPathIndex];

    if (!nextPoint) {
      this.completeNavigation();
      return;
    }

    const dx = nextPoint.x - this.x;
    const dy = nextPoint.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.arrivalThreshold) {
      this.currentPathIndex++;
      if (this.currentPathIndex >= this.currentPath.length) {
        this.completeNavigation();
        return;
      }
    }

    const minDistance = 0.001;
    const safeDistance = Math.max(distance, minDistance);
    const directionX = dx / safeDistance;
    const directionY = dy / safeDistance;
    
    const targetVelX = directionX * PHYSICS_CONFIG.moveSpeed;
    const targetVelY = directionY * PHYSICS_CONFIG.moveSpeed;
    
    const smoothing = 0.15;
    const currentVelX = this.body?.velocity.x || 0;
    const currentVelY = this.body?.velocity.y || 0;
    this.setVelocityX(currentVelX + (targetVelX - currentVelX) * smoothing);
    this.setVelocityY(currentVelY + (targetVelY - currentVelY) * smoothing);
  }

  private completeNavigation(): void {
    this.isNavigating = false;
    this.navigationState = 'arrived';
    this.setVelocityX(0);
    this.arrivalCallback?.();
    this.onArrivalCallbacks.forEach(cb => cb());
    this.arrivalCallback = null;
  }

  isNavigatingToTarget(): boolean {
    return this.isNavigating;
  }

  returnToOriginal(): void {
    if (this.originalPosition) {
      this.moveTo(this.originalPosition.x, this.originalPosition.y);
    }
  }

  getTargetPosition(): { x: number; y: number } | null {
    return this.targetPosition;
  }

  getNavigationState(): NavigationState {
    return this.navigationState;
  }

  getCurrentPath(): PathPoint[] {
    return this.currentPath;
  }

  setArrivalCallback(callback: () => void): void {
    this.onArrivalCallbacks.push(callback);
  }

  clearArrivalCallbacks(): void {
    this.onArrivalCallbacks = [];
  }

  getEmotionSystem(): EmotionSystem {
    return this.emotionSystem;
  }

  setEmotion(emotion: EmotionType, duration?: number): void {
    this.emotionSystem.setEmotion(emotion, duration);
  }

  setEmotionFromTask(taskDescription: string): void {
    const emotion = this.emotionSystem.getEmotionFromTask(taskDescription);
    this.emotionSystem.setEmotion(emotion);
  }

  getOriginalPosition(): { x: number; y: number } | null {
    return this.originalPosition;
  }

  clearOriginalPosition(): void {
    this.originalPosition = null;
  }

  private updateEmotionBubble(): void {
    const delta = this.scene.game.loop.delta;
    const result = this.emotionSystem.update(delta);

    if (!result.needsRedraw) return;

    this.clearEmotionBubble();

    const bubbleConfig = this.emotionSystem.getBubbleConfig(0, -40);
    if (!bubbleConfig) return;

    this.emotionBubble = this.scene.add.container(this.x, this.y + bubbleConfig.y);

    const bg = this.scene.add.graphics();
    const w = bubbleConfig.width;
    const h = bubbleConfig.height;
    bg.fillStyle(bubbleConfig.bgColor, 0.9);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    const text = this.scene.add.text(0, 0, bubbleConfig.emoji, {
      fontSize: '20px',
    });
    text.setOrigin(0.5);

    this.emotionBubble.add([bg, text]);

    if (bubbleConfig.animation.bounceAmplitude > 0) {
      this.scene.tweens.add({
        targets: this.emotionBubble,
        y: this.y + bubbleConfig.y - bubbleConfig.animation.bounceAmplitude,
        duration: bubbleConfig.animation.bounceDuration / 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private clearEmotionBubble(): void {
    if (this.emotionBubble) {
      this.scene.tweens.killTweensOf(this.emotionBubble);
      this.emotionBubble.destroy();
      this.emotionBubble = null;
    }
  }
}

export function createAgent(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  config?: AgentConfig
): AgentCharacter {
  // 角色尺寸：从 32x32 放大到 64x64
  const size = 64;
  const halfSize = size / 2;

  const graphics = scene.add.graphics();
  
  // 绘制角色主体（圆角矩形，更友好）
  graphics.fillStyle(color, 1);
  graphics.fillRoundedRect(-halfSize, -size, size, size, 12);
  
  // 添加边框
  graphics.lineStyle(3, 0xffffff, 0.8);
  graphics.strokeRoundedRect(-halfSize, -size, size, size, 12);
  
  // 添加高光效果
  graphics.fillStyle(0xffffff, 0.3);
  graphics.fillRoundedRect(-halfSize + 4, -size + 4, size - 8, size / 3, 8);
  
  graphics.generateTexture('agent_' + color, size, size);
  graphics.destroy();

  const agent = new AgentCharacter(scene, x, y, 'agent_' + color, undefined, color, config);

  // 在角色上方显示 emoji 头像
  if (config?.emoji) {
    const emojiText = scene.add.text(x, y - size / 2, config.emoji, {
      fontSize: '32px',
    });
    emojiText.setOrigin(0.5);
    emojiText.setDepth(agent.depth + 1);
    
    // 将 emoji 保存到 agent，以便后续更新位置
    (agent as any).emojiText = emojiText;
  }

  return agent;
}
