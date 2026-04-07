import * as Phaser from 'phaser';

export interface VirtualJoystickConfig {
  x?: number;
  y?: number;
  radius?: number;
  knobRadius?: number;
  opacity?: number;
}

const DEFAULT_CONFIG: Required<VirtualJoystickConfig> = {
  x: 100,
  y: 500,
  radius: 60,
  knobRadius: 25,
  opacity: 0.6,
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
  }

  private drawBase(): void {
    const { radius } = this.config;

    this.baseGraphics.clear();
    this.baseGraphics.lineStyle(3, 0x4a5568, 0.8);
    this.baseGraphics.strokeCircle(0, 0, radius);
    this.baseGraphics.fillStyle(0x1a1a2e, 0.5);
    this.baseGraphics.fillCircle(0, 0, radius);
  }

  private drawKnob(offsetX: number, offsetY: number): void {
    const { knobRadius } = this.config;

    this.knobGraphics.clear();
    this.knobGraphics.setPosition(offsetX, offsetY);
    this.knobGraphics.lineStyle(2, 0x718096, 0.9);
    this.knobGraphics.strokeCircle(0, 0, knobRadius);
    this.knobGraphics.fillStyle(0x4a5568, 0.8);
    this.knobGraphics.fillCircle(0, 0, knobRadius);
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
