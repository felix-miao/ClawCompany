import * as Phaser from 'phaser';

import { PHYSICS_CONFIG } from '../config/gameConfig';
import { AnimationController, AnimationState } from '../systems/AnimationController';
import { PathfindingSystem, PathPoint } from '../systems/PathfindingSystem';
import { EmotionSystem, EmotionType } from '../systems/EmotionSystem';
import { CharacterSprites } from '../sprites/CharacterSprites';

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
  private movementTweens: Phaser.Tweens.Tween[] = [];
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
    const isMovingNow = this.isNavigating;

    if (isMovingNow && !this.isMoving) {
      this.playMoveStartAnimation();
    } else if (!isMovingNow && this.isMoving) {
      this.playMoveEndAnimation();
    }
    this.isMoving = isMovingNow;

    if (this.animationController) {
      const isOnFloor = this.getOnFloor();
      this.animationController.update(
        this.lastVelocityX,
        this.lastVelocityY,
        isOnFloor,
        this.isWorking
      );
    } else if (isMovingNow) {
      this.lastVelocityX = 0;
      this.lastVelocityY = 0;
    }

    this.updateEmotionBubble();
    this.syncEmotionBubblePosition();
    this.updateEmojiPosition();
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
    const emojiText = this.emojiText;
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

  /**
   * Tween the sprite directly to (targetX, targetY) without needing a PathfindingSystem.
   * Used by OfficeScene (display-only mode) where no pathfinding grid exists.
   */
  tweenTo(targetX: number, targetY: number, onArrival?: () => void): void {
    this.stopMovement();

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < this.arrivalThreshold) {
      onArrival?.();
      return;
    }

    this.isNavigating = true;
    this.navigationState = 'moving';
    this.lastVelocityX = dx / distance * this.moveSpeed;
    this.lastVelocityY = dy / distance * this.moveSpeed;

    const duration = (distance / this.moveSpeed) * 1000;
    const tween = this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Power2',
      onComplete: () => {
        this.lastVelocityX = 0;
        this.lastVelocityY = 0;
        this.completeNavigation();
        onArrival?.();
      },
    });
    this.movementTweens.push(tween);
  }

  moveTo(targetX: number, targetY: number, onArrival?: () => void): void {
    if (!this.pathfindingSystem) {
      // Fall back to direct tween when no pathfinding system is attached
      this.tweenTo(targetX, targetY, onArrival);
      return;
    }

    this.stopMovement();

    if (!this.originalPosition) {
      this.originalPosition = { x: this.x, y: this.y };
    }

    const path = this.pathfindingSystem.findPath(this.x, this.y, targetX, targetY);
    if (path.length === 0) return;

    this.currentPath = path;
    this.targetPosition = { x: targetX, y: targetY };
    this.isNavigating = true;
    this.navigationState = 'moving';

    if (onArrival) {
      this.arrivalCallback = onArrival;
    }

    this.tweenAlongPath(path, 0);
  }

  private tweenAlongPath(path: PathPoint[], startIndex: number): void {
    if (startIndex >= path.length) {
      this.completeNavigation();
      return;
    }

    const point = path[startIndex];
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.arrivalThreshold) {
      this.tweenAlongPath(path, startIndex + 1);
      return;
    }

    const duration = (distance / this.moveSpeed) * 1000;

    const tween = this.scene.tweens.add({
      targets: this,
      x: point.x,
      y: point.y,
      duration,
      ease: 'Power2',
      onComplete: () => {
        this.lastVelocityX = dx / (duration / 1000);
        this.lastVelocityY = dy / (duration / 1000);
        this.tweenAlongPath(path, startIndex + 1);
      },
    });

    this.movementTweens.push(tween);
  }

  stopMovement(): void {
    for (const tween of this.movementTweens) {
      if (tween.isActive()) {
        tween.stop();
      }
    }
    this.movementTweens = [];
    this.isNavigating = false;
    this.navigationState = 'idle';
    this.setVelocityX(0);
    this.setVelocityY(0);
    this.lastVelocityX = 0;
    this.lastVelocityY = 0;
  }

  private completeNavigation(): void {
    this.movementTweens = [];
    this.isNavigating = false;
    this.navigationState = 'arrived';
    this.setVelocityX(0);
    this.setVelocityY(0);
    this.lastVelocityX = 0;
    this.lastVelocityY = 0;
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

    this.emotionBubble = this.scene.add.container(0, 0);

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
        y: bubbleConfig.y - bubbleConfig.animation.bounceAmplitude,
        duration: bubbleConfig.animation.bounceDuration / 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private syncEmotionBubblePosition(): void {
    if (!this.emotionBubble) return;

    const bubbleConfig = this.emotionSystem.getBubbleConfig(0, -40);
    if (!bubbleConfig) return;

    this.emotionBubble.setPosition(this.x, this.y + bubbleConfig.y);
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
  const sprites = new CharacterSprites(scene, { color });
  sprites.generate();

  const idleKey = 'idle_' + color;
  const agent = new AgentCharacter(scene, x, y, idleKey, undefined, color, config);

  const animationController = new AnimationController(agent, color);
  agent.setAnimationController(animationController);

  if (config?.emoji) {
    const emojiText = scene.add.text(x, y - 32, config.emoji, {
      fontSize: '32px',
    });
    emojiText.setOrigin(0.5);
    emojiText.setDepth(agent.depth + 1);
    
    (agent as { emojiText?: Phaser.GameObjects.Text }).emojiText = emojiText;
  }

  agent.play('idle_' + color);

  return agent;
}
