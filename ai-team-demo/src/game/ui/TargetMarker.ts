import Phaser from 'phaser';

export class TargetMarker extends Phaser.GameObjects.Container {
  private arrowSprite: Phaser.GameObjects.Sprite;
  private distanceText: Phaser.GameObjects.Text;
  private targetPosition: { x: number; y: number } | null = null;
  private distanceThreshold: number = 200;
  private isVisible: boolean = false;

  constructor(scene: Phaser.Scene) {
    const arrowSprite = scene.add.sprite(0, 0, '__DEFAULT');
    arrowSprite.setVisible(false);
    
    const distanceText = scene.add.text(0, -20, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#00000080',
      padding: { x: 4, y: 2 },
    });
    distanceText.setOrigin(0.5);
    distanceText.setVisible(false);

    super(scene, 0, 0, [arrowSprite, distanceText]);
    
    this.arrowSprite = arrowSprite;
    this.distanceText = distanceText;

    scene.add.existing(this);
  }

  setTarget(x: number, y: number): void {
    this.targetPosition = { x, y };
    this.isVisible = true;
    this.arrowSprite.setVisible(true);
    this.distanceText.setVisible(true);
  }

  clearTarget(): void {
    this.targetPosition = null;
    this.isVisible = false;
    this.arrowSprite.setVisible(false);
    this.distanceText.setVisible(false);
  }

  updatePosition(agentX: number, agentY: number): void {
    if (!this.targetPosition || !this.isVisible) return;

    this.x = agentX;
    this.y = agentY - 40;

    const dx = this.targetPosition.x - agentX;
    const dy = this.targetPosition.y - agentY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.distanceText.setText(`${Math.round(distance)}px`);

    const angle = Math.atan2(dy, dx);
    this.arrowSprite.setRotation(angle + Math.PI / 2);

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