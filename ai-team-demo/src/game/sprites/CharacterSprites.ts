import * as Phaser from 'phaser';

export interface CharacterSpritesConfig {
  color: number;
}

export class CharacterSprites {
  private scene: Phaser.Scene;
  private color: number;

  constructor(scene: Phaser.Scene, config: CharacterSpritesConfig) {
    this.scene = scene;
    this.color = config.color;
  }

  generate(): void {
    this.generateIdleFrames();
    this.generateWalkFrames();
    this.generateJumpFrames();
    this.generateWorkFrames();
  }

  private generateIdleFrames(): void {
    const graphics = this.scene.add.graphics();
    const frames: number[] = [];

    for (let i = 0; i < 2; i++) {
      graphics.clear();
      
      graphics.fillStyle(this.color, 1);
      graphics.fillRect(-12, -28, 24, 20);
      
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(-8, -24, 6, 6);
      graphics.fillRect(2, -24, 6, 6);
      
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-6, -22, 2, 2);
      graphics.fillRect(4, -22, 2, 2);
      
      graphics.fillStyle(0xffaa77, 1);
      graphics.fillRect(-4, -16, 8, 4);
      
      const bounce = i === 0 ? 0 : 1;
      graphics.fillStyle(this.darkenColor(this.color), 1);
      graphics.fillRect(-12, -8 + bounce, 24, 8);
      graphics.fillRect(-8, -14 + bounce, 6, 8);

      graphics.generateTexture('idle_' + this.color + '_' + i, 32, 32);
      frames.push(i);
    }
    graphics.destroy();

    this.scene.anims.create({
      key: 'idle_' + this.color,
      frames: frames.map(i => ({ key: 'idle_' + this.color + '_' + i })),
      frameRate: 2,
      repeat: -1
    });
  }

  private generateWalkFrames(): void {
    const graphics = this.scene.add.graphics();
    const frames: number[] = [];

    for (let i = 0; i < 4; i++) {
      graphics.clear();
      
      const legOffset = i % 2 === 0 ? 2 : -2;
      const armOffset = i < 2 ? -2 : 2;
      
      graphics.fillStyle(this.color, 1);
      graphics.fillRect(-12, -28, 24, 20);
      
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(-8, -24, 6, 6);
      graphics.fillRect(2, -24, 6, 6);
      
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-6 + armOffset, -22, 2, 2);
      graphics.fillRect(4 + armOffset, -22, 2, 2);
      
      graphics.fillStyle(0xffaa77, 1);
      graphics.fillRect(-4, -16, 8, 4);
      
      graphics.fillStyle(this.darkenColor(this.color), 1);
      graphics.fillRect(-12, -8 + legOffset, 8, 8);
      graphics.fillRect(4, -8 - legOffset, 8, 8);
      graphics.fillRect(-8, -14, 6, 8);

      graphics.generateTexture('walk_' + this.color + '_' + i, 32, 32);
      frames.push(i);
    }
    graphics.destroy();

    this.scene.anims.create({
      key: 'walk_' + this.color,
      frames: frames.map(i => ({ key: 'walk_' + this.color + '_' + i })),
      frameRate: 8,
      repeat: -1
    });
  }

  private generateJumpFrames(): void {
    const graphics = this.scene.add.graphics();
    const frames: number[] = [];

    for (let i = 0; i < 2; i++) {
      graphics.clear();
      
      const bodyOffset = i === 0 ? -2 : 2;
      
      graphics.fillStyle(this.color, 1);
      graphics.fillRect(-12, -28 + bodyOffset, 24, 20);
      
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(-8, -24 + bodyOffset, 6, 6);
      graphics.fillRect(2, -24 + bodyOffset, 6, 6);
      
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-6, -22 + bodyOffset, 2, 2);
      graphics.fillRect(4, -22 + bodyOffset, 2, 2);
      
      graphics.fillStyle(0xffaa77, 1);
      graphics.fillRect(-4, -16 + bodyOffset, 8, 4);
      
      graphics.fillStyle(this.darkenColor(this.color), 1);
      graphics.fillRect(-14, -8, 6, 8);
      graphics.fillRect(8, -8, 6, 8);
      graphics.fillRect(-8, -14 + bodyOffset, 6, 8);

      graphics.generateTexture('jump_' + this.color + '_' + i, 32, 32);
      frames.push(i);
    }
    graphics.destroy();

    this.scene.anims.create({
      key: 'jump_' + this.color,
      frames: frames.map(i => ({ key: 'jump_' + this.color + '_' + i })),
      frameRate: 6,
      repeat: -1
    });
  }

  private generateWorkFrames(): void {
    const graphics = this.scene.add.graphics();
    const frames: number[] = [];

    for (let i = 0; i < 3; i++) {
      graphics.clear();
      
      const typingOffset = i === 1 ? 2 : 0;
      
      graphics.fillStyle(this.color, 1);
      graphics.fillRect(-12, -28, 24, 20);
      
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(-8, -24, 6, 6);
      graphics.fillRect(2, -24, 6, 6);
      
      graphics.fillStyle(0x000000, 1);
      graphics.fillRect(-6, -22, 2, 2);
      graphics.fillRect(4, -22, 2, 2);
      
      graphics.fillStyle(0xffaa77, 1);
      graphics.fillRect(-4, -16, 8, 4);
      
      graphics.fillStyle(this.darkenColor(this.color), 1);
      graphics.fillRect(-12 + typingOffset, -8, 24, 8);
      graphics.fillRect(-8, -14, 6, 8);
      
      graphics.fillStyle(0x555555, 1);
      graphics.fillRect(14, -18 + typingOffset, 8, 12);
      if (i === 1) {
        graphics.fillStyle(0x00ff00, 0.5);
        graphics.fillRect(16, -16, 4, 2);
      }

      graphics.generateTexture('work_' + this.color + '_' + i, 32, 32);
      frames.push(i);
    }
    graphics.destroy();

    this.scene.anims.create({
      key: 'work_' + this.color,
      frames: frames.map(i => ({ key: 'work_' + this.color + '_' + i })),
      frameRate: 6,
      repeat: -1
    });
  }

  private darkenColor(color: number, amount: number = 0.3): number {
    const r = ((color >> 16) & 0xff) * (1 - amount);
    const g = ((color >> 8) & 0xff) * (1 - amount);
    const b = (color & 0xff) * (1 - amount);
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }
}

export function createCharacterSprites(scene: Phaser.Scene, color: number): CharacterSprites {
  const sprites = new CharacterSprites(scene, { color });
  sprites.generate();
  return sprites;
}
