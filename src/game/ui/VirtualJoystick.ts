import * as Phaser from 'phaser';

export interface VirtualJoystickConfig {
  x?: number;
  y?: number;
  radius?: number;
  knobRadius?: number;
  opacity?: number;
  autoShow?: boolean;
  vibrateOnActive?: boolean;
}

const DEFAULT_CONFIG: Required<VirtualJoystickConfig> = {
  x: 100,
  y: 500,
  radius: 60,
  knobRadius: 25,
  opacity: 0.6,
  autoShow: false,
  vibrateOnActive: false,
};

export class VirtualJoystick {
  private scene: Phaser.Scene;
  private config: Required<VirtualJoystickConfig>;
  private container: Phaser.GameObjects.Container;
  private baseGraphics: Phaser.GameObjects.Graphics;
  private knobGraphics: Phaser.GameObjects.Graphics;
  private destroyed: boolean = false;
  private visible: boolean = false;
  private active: boolean = false;
  private pointerId: number | null = null;
  private direction: { x: number; y: number } = { x: 0, y: 0 };
  private basePosition: { x: number; y: number };
  private knobOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, config?: VirtualJoystickConfig) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.basePosition = { x: this.config.x, y: this.config.y };

    this.container = scene.add.container(this.config.x, this.config.y);
    this.container.setDepth(300);
    this.container.setVisible(false);
    this.container.setAlpha(this.config.opacity);

    this.baseGraphics = scene.add.graphics();
    this.knobGraphics = scene.add.graphics();

    this.drawBase();
    this.drawKnob(0, 0);

    this.container.add([this.baseGraphics, this.knobGraphics]);

    this.setupInputHandlers();

    // 自动显示支持
    if (this.config.autoShow) {
      this.autoShowForTouch();
    }
  }

  private drawBase(): void {
    const { radius } = this.config;

    this.baseGraphics.clear();
    
    // 外圈
    this.baseGraphics.lineStyle(4, 0x4a5568, 0.9);
    this.baseGraphics.strokeCircle(0, 0, radius);
    
    // 内圈装饰
    this.baseGraphics.lineStyle(2, 0x718096, 0.6);
    this.baseGraphics.strokeCircle(0, 0, radius - 10);
    
    // 填充
    this.baseGraphics.fillStyle(0x1a1a2e, 0.7);
    this.baseGraphics.fillCircle(0, 0, radius);
    
    // 中心点
    this.baseGraphics.fillStyle(0x4a5568, 0.8);
    this.baseGraphics.fillCircle(0, 0, 4);
  }

  private drawKnob(offsetX: number, offsetY: number): void {
    const { knobRadius } = this.config;

    this.knobGraphics.clear();
    this.knobGraphics.setPosition(offsetX, offsetY);
    
    // 外圈
    this.knobGraphics.lineStyle(3, 0x718096, 1);
    this.knobGraphics.strokeCircle(0, 0, knobRadius);
    
    // 内圈
    this.knobGraphics.lineStyle(1, 0xa0aec0, 0.8);
    this.knobGraphics.strokeCircle(0, 0, knobRadius - 5);
    
    // 填充
    this.knobGraphics.fillStyle(0x4a5568, 0.9);
    this.knobGraphics.fillCircle(0, 0, knobRadius);
    
    // 高光效果
    this.knobGraphics.fillStyle(0x718096, 0.3);
    this.knobGraphics.fillCircle(-knobRadius/3, -knobRadius/3, knobRadius/3);
  }

  private setupInputHandlers(): void {
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.destroyed || !this.visible || !pointer.wasTouch) return;
    if (this.pointerId !== null) return;

    const pointerX = pointer.x;
    const pointerY = pointer.y;

    const dx = pointerX - this.basePosition.x;
    const dy = pointerY - this.basePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= this.config.radius * 1.5) {
      this.active = true;
      this.pointerId = pointer.id;
      this.updateKnobPosition(pointerX, pointerY);
      
      // 触控反馈
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.1,
        duration: 100,
        yoyo: true,
        ease: 'Power2'
      });
      
      // 振动反馈
      if (this.config.vibrateOnActive) {
        this.vibrate();
      }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.destroyed || !this.active) return;
    if (pointer.id !== this.pointerId) return;

    this.updateKnobPosition(pointer.x, pointer.y);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.destroyed) return;
    if (pointer.id !== this.pointerId) return;

    this.active = false;
    this.pointerId = null;
    this.direction = { x: 0, y: 0 };
    this.knobOffset = { x: 0, y: 0 };
    
    // 返回中心位置的动画
    this.scene.tweens.add({
      targets: this.knobGraphics,
      x: 0,
      y: 0,
      duration: 200,
      ease: 'Power2'
    });
    
    this.drawKnob(0, 0);
  }

  private updateKnobPosition(pointerX: number, pointerY: number): void {
    const dx = pointerX - this.basePosition.x;
    const dy = pointerY - this.basePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = this.config.radius - this.config.knobRadius;

    let normalizedX = dx;
    let normalizedY = dy;

    if (distance > maxDistance) {
      const scale = maxDistance / distance;
      normalizedX *= scale;
      normalizedY *= scale;
    }

    this.knobOffset = { x: normalizedX, y: normalizedY };
    this.drawKnob(normalizedX, normalizedY);

    if (distance > 0) {
      this.direction = {
        x: dx / distance,
        y: dy / distance,
      };
    } else {
      this.direction = { x: 0, y: 0 };
    }
  }

  show(): void {
    if (this.destroyed) return;
    this.visible = true;
    this.container.setVisible(true);

    this.scene.tweens.add({
      targets: this.container,
      alpha: this.config.opacity,
      duration: 200,
      ease: 'Power2',
    });
  }

  hide(): void {
    if (this.destroyed) return;
    this.visible = false;
    this.container.setVisible(false);
    this.active = false;
    this.pointerId = null;
    this.direction = { x: 0, y: 0 };
  }

  isVisible(): boolean {
    return this.visible;
  }

  isActive(): boolean {
    return this.active;
  }

  getDirection(): { x: number; y: number } {
    return { ...this.direction };
  }

  setPosition(x: number, y: number): void {
    this.basePosition = { x, y };
    this.container.setPosition(x, y);
  }

  isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  autoShowForTouch(): void {
    if (this.isTouchDevice()) {
      this.show();
    }
  }

  private vibrate(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate && typeof navigator.vibrate === 'function') {
      navigator.vibrate(50);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);

    this.baseGraphics.destroy();
    this.knobGraphics.destroy();
    this.container.destroy();
  }
}
