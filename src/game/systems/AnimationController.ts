import * as Phaser from 'phaser';

export type AnimationState = 'idle' | 'moving' | 'jumping' | 'working';

export class AnimationController {
  private sprite: Phaser.Physics.Arcade.Sprite;
  private currentState: AnimationState = 'idle';
  private color: number;
  private isTransitioning: boolean = false;
  private transitionCooldown: number = 100;
  private lastTransitionTime: number = 0;

  constructor(sprite: Phaser.Physics.Arcade.Sprite, color: number) {
    this.sprite = sprite;
    this.color = color;
  }

  update(velocityX: number, velocityY: number, isOnFloor: boolean, isWorking: boolean): void {
    const now = this.sprite.scene.time.now;

    if (isWorking) {
      this.playAnimation('working', now);
      return;
    }

    if (!isOnFloor && velocityY < -50) {
      this.playAnimation('jumping', now);
      return;
    }

    if (Math.abs(velocityX) > 10) {
      this.playAnimation('moving', now);
      if (velocityX > 0) {
        this.sprite.setFlipX(false);
      } else if (velocityX < 0) {
        this.sprite.setFlipX(true);
      }
      return;
    }

    this.playAnimation('idle', now);
  }

  private playAnimation(state: AnimationState, now: number): void {
    if (this.currentState === state) {
      return;
    }

    if (this.isTransitioning) {
      if (now - this.lastTransitionTime < this.transitionCooldown) {
        return;
      }
      this.isTransitioning = false;
    }

    const animationKey = `${state}_${this.color}`;
    const animation = this.sprite.scene.anims.get(animationKey);

    if (animation) {
      this.sprite.play(animationKey);
      this.currentState = state;
      this.lastTransitionTime = now;
    }
  }

  setState(state: AnimationState): void {
    this.currentState = state;
  }

  getState(): AnimationState {
    return this.currentState;
  }

  forcePlay(state: AnimationState): void {
    const now = this.sprite.scene.time.now;
    this.isTransitioning = false;
    this.playAnimation(state, now);
  }

  stop(): void {
    this.sprite.anims.stop();
  }
}
