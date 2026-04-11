import * as Phaser from 'phaser';

export type AnimationState = 'idle' | 'moving' | 'jumping' | 'working';

// Map AnimationState to the key suffix registered by CharacterSpriteSystem
const STATE_TO_ANIM_SUFFIX: Record<AnimationState, string> = {
  idle: 'idle',
  moving: 'walk',
  jumping: 'walk', // no jump animation registered; fall back to walk
  working: 'work',
};

export class AnimationController {
  private sprite: Phaser.Physics.Arcade.Sprite;
  private currentState: AnimationState = 'idle';
  private role: string;
  private isTransitioning: boolean = false;
  private transitionCooldown: number = 100;
  private lastTransitionTime: number = 0;

  /**
   * @param sprite - The Phaser sprite to animate
   * @param roleOrColor - Role string (e.g. "pm", "dev") used to look up animations
   *   registered by CharacterSpriteSystem as `${role}_idle`, `${role}_walk`, `${role}_work`.
   *   A legacy numeric color is accepted for backwards compatibility (converted to string).
   */
  constructor(sprite: Phaser.Physics.Arcade.Sprite, roleOrColor: string | number) {
    this.sprite = sprite;
    this.role = typeof roleOrColor === 'string' ? roleOrColor.toLowerCase() : String(roleOrColor);
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

    // Key format matches CharacterSpriteSystem: e.g. "pm_idle", "dev_walk", "tester_work"
    const animationKey = `${this.role}_${STATE_TO_ANIM_SUFFIX[state]}`;
    const animation = this.sprite.scene.anims.get(animationKey);

    this.currentState = state;
    this.lastTransitionTime = now;

    if (animation) {
      this.sprite.play(animationKey);
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
