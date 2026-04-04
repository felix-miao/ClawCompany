import * as Phaser from 'phaser';

export class TargetMarker extends Phaser.GameObjects.Container {
  private circleGraphics: Phaser.GameObjects.Graphics;
  private distanceText: Phaser.GameObjects.Text;
  private targetPosition: { x: number; y: number } | null = null;
  private distanceThreshold: number = 200;
  private isVisible: boolean = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    const graphics = scene.add.graphics();
    
    const distanceText = scene.add.text(0, -30, '', {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#00000080',
      padding: { x: 4, y: 2 },
    });
    distanceText.setOrigin(0.5);
    distanceText.setVisible(false);

    super(scene, 0, 0, [graphics, distanceText]);
    
    this.circleGraphics = graphics;
    this.distanceText = distanceText;

    scene.add.existing(this);
  }

  setTarget(x: number, y: number): void {
    this.targetPosition = { x, y };
    this.isVisible = true;
    this.distanceText.setVisible(true);
    this.drawCircle(x, y, 0);
    this.startPulseAnimation(x, y);
  }

  private drawCircle(x: number, y: number, radius: number): void {
    this.circleGraphics.clear();
    this.circleGraphics.lineStyle(3, 0x00ff00, 0.8);
    this.circleGraphics.strokeCircle(x - this.x, y - this.y, radius);
    
    this.circleGraphics.fillStyle(0x00ff00, 0.3);
    this.circleGraphics.fillCircle(x - this.x, y - this.y, 15);
  }

  private startPulseAnimation(x: number, y: number): void {
    if (this.pulseTween) {
      this.pulseTween.stop();
    }

    const positions = [
      { radius: 20, alpha: 0.8 },
      { radius: 35, alpha: 0.4 },
      { radius: 50, alpha: 0 },
    ];

    this.pulseTween = this.scene.tweens.addCounter({
      from: 0,
      to: 100,
      duration: 1000,
      repeat: -1,
      onUpdate: (tween) => {
        const value = tween.getValue() ?? 0;
        const index = Math.floor(value / 33.33) % 3;
        const pos = positions[index];
        const nextPos = positions[(index + 1) % 3];
        const progress = (value % 33.33) / 33.33;
        
        const radius = pos.radius + (nextPos.radius - pos.radius) * progress;
        const alpha = pos.alpha + (nextPos.alpha - pos.alpha) * progress;
        
        this.circleGraphics.clear();
        this.circleGraphics.lineStyle(3, 0x00ff00, alpha);
        this.circleGraphics.strokeCircle(x - this.x, y - this.y, radius);
      },
    });
  }

  clearTarget(): void {
    this.targetPosition = null;
    this.isVisible = false;
    this.distanceText.setVisible(false);
    this.circleGraphics.clear();
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
  }

  updatePosition(agentX: number, agentY: number): void {
    if (!this.targetPosition || !this.isVisible) return;

    this.x = agentX;
    this.y = agentY - 40;

    const dx = this.targetPosition.x - agentX;
    const dy = this.targetPosition.y - agentY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.distanceText.setText(`${Math.round(distance)}px`);

    if (distance < 20) {
      this.clearTarget();
    }

    if (distance < this.distanceThreshold) {
      this.setAlpha(1 - distance / this.distanceThreshold);
    } else {
      this.setAlpha(1);
    }
  }

  isActive(): boolean {
    return this.isVisible && this.targetPosition !== null;
  }

  getTargetPosition(): { x: number; y: number } | null {
    return this.targetPosition;
  }
}