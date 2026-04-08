import * as Phaser from 'phaser';

const PULSE_MAX_RADIUS = 40;
const PULSE_MIN_RADIUS = 15;
const PULSE_DURATION = 1500;
const PULSE_COLORS = {
  high: 0xFF0000,
  medium: 0xFFA500,
  low: 0x00FF00,
};

export class PriorityPulseEffect {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private priority: string = 'medium';
  private intensity: number = 0.5;
  private targetAlpha: number = 0;
  private currentAlpha: number = 0;
  private destroyed: boolean = false;
  private pulsePhase: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(110);
    this.graphics.setAlpha(0);

    // 创建粒子效果
    this.particles = scene.add.particles(0, 0, 'particle', {
      speed: { min: 20, max: 50 },
      scale: { start: 0.4, end: 0 },
      lifespan: 1000,
      gravityY: 0,
      alpha: { start: 0.8, end: 0 },
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.particles.setDepth(109);
  }

  setPriority(priority: string): void {
    this.priority = priority;
    this.updateEffect();
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.updateEffect();
  }

  setPosition(x: number, y: number): void {
    this.graphics.setPosition(x, y);
    this.particles.setPosition(x, y);
  }

  show(): void {
    this.targetAlpha = 0.6;
  }

  hide(): void {
    this.targetAlpha = 0;
  }

  update(): void {
    if (this.destroyed) return;

    // 更新脉冲相位
    this.pulsePhase += 0.05;
    if (this.pulsePhase > Math.PI * 2) {
      this.pulsePhase = 0;
    }

    // 平滑透明度动画
    const alphaDiff = this.targetAlpha - this.currentAlpha;
    if (Math.abs(alphaDiff) > 0.01) {
      this.currentAlpha += alphaDiff * 0.15;
      this.graphics.setAlpha(this.currentAlpha * this.intensity);
      this.particles.setAlpha(this.currentAlpha * this.intensity);
    }

    if (this.currentAlpha > 0.01) {
      this.drawPulseEffect();
      this.updateParticles();
    }
  }

  private drawPulseEffect(): void {
    this.graphics.clear();

    if (this.currentAlpha <= 0.01) return;

    const color = PULSE_COLORS[this.priority as keyof typeof PULSE_COLORS] || PULSE_COLORS.medium;
    const alpha = this.currentAlpha * this.intensity;

    // 计算脉冲半径
    const pulseScale = (Math.sin(this.pulsePhase) + 1) / 2; // 0 到 1
    const currentRadius = PULSE_MIN_RADIUS + (PULSE_MAX_RADIUS - PULSE_MIN_RADIUS) * pulseScale;

    // 绘制多层脉冲圆环
    for (let i = 0; i < 3; i++) {
      const ringRadius = currentRadius - i * 8;
      if (ringRadius > 0) {
        const ringAlpha = alpha * (1 - i * 0.3);
        this.graphics.lineStyle(2, color, ringAlpha);
        this.graphics.strokeCircle(0, 0, ringRadius);
      }
    }

    // 绘制中心点
    this.graphics.fillStyle(color, alpha * 0.8);
    this.graphics.fillCircle(0, 0, 3);
  }

  private updateParticles(): void {
    if (this.currentAlpha <= 0.01) return;

    // 根据脉冲相位发射粒子
    if (Math.sin(this.pulsePhase) > 0.8) {
      const color = PULSE_COLORS[this.priority as keyof typeof PULSE_COLORS] || PULSE_COLORS.medium;
      
      // 重置粒子颜色
      this.particles.stop();
      
      // 创建临时纹理
      const tempGraphics = this.scene.add.graphics();
      tempGraphics.fillStyle(color, 1);
      tempGraphics.fillCircle(3, 3, 3);
      tempGraphics.generateTexture('pulse-particle', 6, 6);
      tempGraphics.destroy();

      // 使用新纹理发射粒子
      this.particles.setTexture('pulse-particle');
      
      // 发射粒子
      this.particles.explode(1);
    }
  }

  isActive(): boolean {
    return this.currentAlpha > 0.01;
  }

  destroy(): void {
    this.destroyed = true;
    this.graphics.destroy();
    this.particles.destroy();
    
    // 清理临时纹理
    this.scene.textures.remove('pulse-particle');
  }

  private updateEffect(): void {
    // 更新效果参数 - 根据优先级调整粒子速度
    // 注意: Phaser 3.60+ 移除了 setSpeed,使用 emitterConfig 替代
    // 这里简化处理,不动态调整速度
  }
}