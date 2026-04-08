import * as Phaser from 'phaser';

import { TaskStatus } from '../types/Task';

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay: number;
}

export interface StatusAnimation {
  type: 'statusChange' | 'priorityChange' | 'progressUpdate';
  from: TaskStatus;
  to: TaskStatus;
  timestamp: number;
}

export class StatusAnimationSystem {
  private scene: Phaser.Scene;
  private animations: Map<string, StatusAnimation[]> = new Map();
  private activeAnimations: Map<string, Phaser.Tweens.Tween[]> = new Map();
  private animationConfigs: Record<string, AnimationConfig> = {
    statusChange: { duration: 500, easing: 'Power2', delay: 0 },
    priorityChange: { duration: 300, easing: 'Power1', delay: 0 },
    progressUpdate: { duration: 200, easing: 'Linear', delay: 0 },
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  triggerStatusChange(agentId: string, fromStatus: TaskStatus, toStatus: TaskStatus): void {
    const animation: StatusAnimation = {
      type: 'statusChange',
      from: fromStatus,
      to: toStatus,
      timestamp: Date.now(),
    };

    // 添加到动画队列
    if (!this.animations.has(agentId)) {
      this.animations.set(agentId, []);
    }
    this.animations.get(agentId)!.push(animation);

    // 立即执行动画
    this.executeStatusAnimation(agentId, animation);
  }

  triggerPriorityChange(agentId: string, newPriority: string): void {
    // 优先级变化动画 - 简化版本,不使用 killTweensOf
    const scaleTween = this.scene.tweens.add({
      targets: agentId,
      scale: 1.3,
      duration: this.animationConfigs.priorityChange.duration,
      ease: this.animationConfigs.priorityChange.easing,
      yoyo: true,
    });

    // 颜色闪烁动画
    const colorTween = this.scene.tweens.add({
      targets: agentId,
      alpha: 0.5,
      duration: this.animationConfigs.priorityChange.duration / 2,
      ease: 'Power1',
      yoyo: true,
      repeat: 1,
    });

    this.activeAnimations.set(agentId, [scaleTween, colorTween]);

    // 清理动画
    this.scene.time.delayedCall(this.animationConfigs.priorityChange.duration * 2, () => {
      this.cleanupAnimation(agentId);
    });
  }

  triggerProgressUpdate(agentId: string, progress: number): void {
    // 进度更新动画
    const tweens: Phaser.Tweens.Tween[] = [];

    // 进度条填充动画
    const progressTween = this.scene.tweens.add({
      targets: agentId,
      prop: 'progress',
      duration: this.animationConfigs.progressUpdate.duration,
      ease: this.animationConfigs.progressUpdate.easing,
    });

    // 旋转动画（表示更新）
    const rotateTween = this.scene.tweens.add({
      targets: agentId,
      rotation: '+0.5',
      duration: this.animationConfigs.progressUpdate.duration / 2,
      ease: 'Power1',
      yoyo: true,
    });

    tweens.push(progressTween, rotateTween);

    this.activeAnimations.set(agentId, tweens);

    // 清理动画
    this.scene.time.delayedCall(this.animationConfigs.progressUpdate.duration, () => {
      this.cleanupAnimation(agentId);
    });
  }

  private executeStatusAnimation(agentId: string, animation: StatusAnimation): void {
    const tweens: Phaser.Tweens.Tween[] = [];

    switch (animation.to) {
      case 'assigned':
        // 分配任务时的动画
        const assignedTweens = this.createAssignedAnimation(agentId);
        tweens.push(...assignedTweens);
        break;

      case 'working':
        // 开始工作时的动画
        const workingTweens = this.createWorkingAnimation(agentId);
        tweens.push(...workingTweens);
        break;

      case 'reviewing':
        // 审查时的动画
        const reviewingTweens = this.createReviewingAnimation(agentId);
        tweens.push(...reviewingTweens);
        break;

      case 'completed':
        // 完成时的庆祝动画
        const completedTweens = this.createCompletedAnimation(agentId);
        tweens.push(...completedTweens);
        break;

      case 'failed':
        // 失败时的动画
        const failedTweens = this.createFailedAnimation(agentId);
        tweens.push(...failedTweens);
        break;
    }

    this.activeAnimations.set(agentId, tweens);

    // 清理动画
    this.scene.time.delayedCall(this.animationConfigs.statusChange.duration, () => {
      this.cleanupAnimation(agentId);
      // 继续队列中的下一个动画
      this.processNextAnimation(agentId);
    });
  }

  private createAssignedAnimation(agentId: string): Phaser.Tweens.Tween[] {
    const tweens: Phaser.Tweens.Tween[] = [];

    // 弹跳动画
    const bounceTween = this.scene.tweens.add({
      targets: agentId,
      y: '-=20',
      duration: 200,
      ease: 'Bounce.easeOut',
      yoyo: true,
      repeat: 1,
    });

    // 缩放动画
    const scaleTween = this.scene.tweens.add({
      targets: agentId,
      scale: 1.2,
      duration: 300,
      ease: 'Power2',
      yoyo: true,
    });

    // 旋转动画
    const rotateTween = this.scene.tweens.add({
      targets: agentId,
      rotation: 0.5,
      duration: 400,
      ease: 'Power2',
      yoyo: true,
    });

    tweens.push(bounceTween, scaleTween, rotateTween);

    return tweens;
  }

  private createWorkingAnimation(agentId: string): Phaser.Tweens.Tween[] {
    const tweens: Phaser.Tweens.Tween[] = [];

    // 持续的脉冲动画
    const pulseTween = this.scene.tweens.add({
      targets: agentId,
      scale: 1.1,
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // 轻微的上下浮动
    const floatTween = this.scene.tweens.add({
      targets: agentId,
      y: '+=10',
      duration: 2000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    tweens.push(pulseTween, floatTween);

    return tweens;
  }

  private createReviewingAnimation(agentId: string): Phaser.Tweens.Tween[] {
    const tweens: Phaser.Tweens.Tween[] = [];

    // 左右摇摆动画
    const shakeTween = this.scene.tweens.add({
      targets: agentId,
      x: '+=10',
      duration: 100,
      ease: 'Power1',
      yoyo: true,
      repeat: 5,
    });

    // 放大动画
    const zoomTween = this.scene.tweens.add({
      targets: agentId,
      scale: 1.15,
      duration: 200,
      ease: 'Power2',
      yoyo: true,
    });

    tweens.push(shakeTween, zoomTween);

    return tweens;
  }

  private createCompletedAnimation(agentId: string): Phaser.Tweens.Tween[] {
    const tweens: Phaser.Tweens.Tween[] = [];

    // 大弹跳动画
    const bounceTween = this.scene.tweens.add({
      targets: agentId,
      y: '-=40',
      duration: 400,
      ease: 'Bounce.easeOut',
      yoyo: true,
      repeat: 1,
    });

    // 大缩放动画
    const scaleTween = this.scene.tweens.add({
      targets: agentId,
      scale: 1.5,
      duration: 300,
      ease: 'Back.easeOut',
      yoyo: true,
    });

    // 旋转庆祝动画
    const celebrateTween = this.scene.tweens.add({
      targets: agentId,
      rotation: Math.PI * 2,
      duration: 600,
      ease: 'Power2',
    });

    // 发光效果
    const glowTween = this.scene.tweens.add({
      targets: agentId,
      alpha: 0.5,
      duration: 200,
      ease: 'Power1',
      yoyo: true,
      repeat: 3,
    });

    tweens.push(bounceTween, scaleTween, celebrateTween, glowTween);

    return tweens;
  }

  private createFailedAnimation(agentId: string): Phaser.Tweens.Tween[] {
    const tweens: Phaser.Tweens.Tween[] = [];

    // 下沉动画
    const dropTween = this.scene.tweens.add({
      targets: agentId,
      y: '+=20',
      duration: 300,
      ease: 'Power2',
    });

    // 颜色闪烁动画
    const flickerTween = this.scene.tweens.add({
      targets: agentId,
      alpha: 0.3,
      duration: 100,
      ease: 'Power1',
      yoyo: true,
      repeat: 5,
    });

    // 摇摆动画
    const shakeTween = this.scene.tweens.add({
      targets: agentId,
      rotation: 0.3,
      duration: 150,
      ease: 'Power1',
      yoyo: true,
      repeat: 3,
    });

    tweens.push(dropTween, flickerTween, shakeTween);

    return tweens;
  }

  private processNextAnimation(agentId: string): void {
    const agentAnimations = this.animations.get(agentId);
    if (!agentAnimations || agentAnimations.length === 0) return;

    const nextAnimation = agentAnimations.shift()!;
    this.executeStatusAnimation(agentId, nextAnimation);
  }

  private cleanupAnimation(agentId: string): void {
    const activeTweens = this.activeAnimations.get(agentId);
    if (activeTweens) {
      activeTweens.forEach(tween => tween.stop());
      this.activeAnimations.delete(agentId);
    }
  }

  // 添加自定义动画配置
  setAnimationConfig(type: string, config: AnimationConfig): void {
    this.animationConfigs[type] = config;
  }

  // 清理所有动画
  clearAllAnimations(): void {
    for (const [agentId, tweens] of this.activeAnimations.entries()) {
      tweens.forEach(tween => tween.stop());
    }
    this.activeAnimations.clear();
    this.animations.clear();
  }

  // 停止特定代理的所有动画
  stopAgentAnimations(agentId: string): void {
    const tweens = this.activeAnimations.get(agentId);
    if (tweens) {
      tweens.forEach(tween => tween.stop());
      this.activeAnimations.delete(agentId);
    }
    
    // 清理动画队列
    this.animations.delete(agentId);
  }

  // 获取代理当前动画状态
  getAgentAnimationState(agentId: string): {
    hasAnimations: boolean;
    activeTweens: number;
    queuedAnimations: number;
  } {
    const activeTweens = this.activeAnimations.get(agentId) || [];
    const queuedAnimations = this.animations.get(agentId) || [];

    return {
      hasAnimations: activeTweens.length > 0 || queuedAnimations.length > 0,
      activeTweens: activeTweens.length,
      queuedAnimations: queuedAnimations.length,
    };
  }
}