import * as Phaser from 'phaser';

export interface TinyTownConfig {
  prefix?: string;
  tileSize?: number;
}

export class TinyTownLoader {
  private scene: Phaser.Scene;
  private config: TinyTownConfig;

  constructor(scene: Phaser.Scene, config: TinyTownConfig = {}) {
    this.scene = scene;
    this.config = {
      prefix: 'tiny-town',
      tileSize: 32,
      ...config
    };
  }

  /**
   * Synchronously register all default textures + animations.
   * Call this from a Phaser Scene's preload() so textures are ready before create().
   */
  preloadSync(): void {
    this.createDefaultCharacterSprites();
    this.createDefaultEnvironmentTiles();
  }

  async loadResources(): Promise<void> {
    console.log('🚀 开始加载 Tiny Town 资源...');
    
    try {
      // 首先尝试加载瓷砖集
      await this.loadTileset();
      
      // 然后加载角色精灵
      await this.loadCharacterSprites();
      
      // 加载环境资源
      await this.loadEnvironmentTiles();
      
      console.log('✅ Tiny Town 资源加载完成');
    } catch (error) {
      console.warn('⚠️ Tiny Town 资源加载失败，使用默认资源:', error);
      this.loadFallbackResources();
    }
  }

  private loadTileset(): Promise<void> {
    return Promise.resolve();
  }

  private async loadCharacterSprites(): Promise<void> {
    console.log('👤 加载角色精灵...');
    
    // 创建默认角色精灵
    this.createDefaultCharacterSprites();
  }

  private async loadEnvironmentTiles(): Promise<void> {
    console.log('🏢 加载环境资源...');
    
    // 创建默认环境资源
    this.createDefaultEnvironmentTiles();
  }

  private loadFallbackResources(): void {
    console.log('🎨 创建默认资源...');
    this.createDefaultCharacterSprites();
    this.createDefaultEnvironmentTiles();
  }

  private createDefaultCharacterSprites(): void {
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4];
    const roles = ['pm', 'dev', 'tester', 'reviewer'];

    roles.forEach((role, index) => {
      if (index < colors.length) {
        this.createDefaultCharacterSprite(colors[index], role);
      }
    });
  }

  private createDefaultCharacterSprite(color: number, role: string): void {
    // All drawing MUST be in the range [0, size) so generateTexture captures it.
    const size = 64;
    const g = this.scene.add.graphics();

    // Body
    g.fillStyle(color, 1);
    g.fillRect(8, 4, size - 16, size - 8);

    // Header band
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(12, 8, size - 24, 14);

    // Eyes
    g.fillStyle(0x000000, 1);
    g.fillRect(16, 28, 6, 6);
    g.fillRect(size - 22, 28, 6, 6);

    // Mouth — unique per role
    g.fillStyle(0x111111, 1);
    if (role === 'pm') {
      g.fillRect(20, 40, 4, 3); g.fillRect(40, 40, 4, 3);
      g.fillRect(24, 42, 16, 3);
    } else if (role === 'dev') {
      g.fillRect(20, 41, 24, 2);
    } else if (role === 'tester') {
      g.fillRect(20, 38, 24, 2);
      g.fillRect(20, 44, 24, 2);
    } else {
      g.fillRect(20, 44, 4, 3); g.fillRect(40, 44, 4, 3);
      g.fillRect(24, 42, 16, 3);
    }

    // Border
    g.lineStyle(2, 0x00000055, 1);
    g.strokeRect(8, 4, size - 16, size - 8);

    const textureName = `character-${role}`;
    g.generateTexture(textureName, size, size);
    g.destroy();

    this.createCharacterAnimations(textureName, role);
  }

  private createCharacterAnimations(spriteName: string, role: string): void {
    // Keys match AnimationController format: `${role}_idle`, `${role}_walk`, `${role}_work`
    this.scene.anims.create({
      key: `${role}_idle`,
      frames: [
        { key: spriteName, frame: 0 },
      ],
      frameRate: 2,
      repeat: -1
    });

    this.scene.anims.create({
      key: `${role}_walk`,
      frames: [
        { key: spriteName, frame: 0 },
        { key: spriteName, frame: 0 },
        { key: spriteName, frame: 0 },
        { key: spriteName, frame: 0 },
      ],
      frameRate: 8,
      repeat: -1
    });

    this.scene.anims.create({
      key: `${role}_work`,
      frames: [
        { key: spriteName, frame: 0 },
        { key: spriteName, frame: 0 },
        { key: spriteName, frame: 0 },
      ],
      frameRate: 6,
      repeat: -1
    });
  }

  private createDefaultEnvironmentTiles(): void {
    // 创建默认的办公室资产
    console.log('创建默认办公室资产...');
    
    // 创建地板
    const floorGraphics = this.scene.add.graphics();
    floorGraphics.fillStyle(0x8B4513, 1);
    floorGraphics.fillRect(0, 0, 32, 32);
    floorGraphics.lineStyle(1, 0x654321, 1);
    floorGraphics.strokeRect(0, 0, 32, 32);
    floorGraphics.generateTexture('floor', 32, 32);
    floorGraphics.destroy();

    // 创建墙壁
    const wallGraphics = this.scene.add.graphics();
    wallGraphics.fillStyle(0xDDDDDD, 1);
    wallGraphics.fillRect(0, 0, 32, 32);
    wallGraphics.lineStyle(1, 0xBBBBBB, 1);
    wallGraphics.strokeRect(0, 0, 32, 32);
    wallGraphics.generateTexture('wall', 32, 32);
    wallGraphics.destroy();

    // 创建桌子
    const deskGraphics = this.scene.add.graphics();
    deskGraphics.fillStyle(0x8B4513, 1);
    deskGraphics.fillRect(0, 0, 32, 16);
    deskGraphics.fillRect(4, 16, 24, 8);
    deskGraphics.lineStyle(1, 0x654321, 1);
    deskGraphics.strokeRect(0, 0, 32, 24);
    deskGraphics.generateTexture('desk', 32, 24);
    deskGraphics.destroy();

    // 创建椅子
    const chairGraphics = this.scene.add.graphics();
    chairGraphics.fillStyle(0x654321, 1);
    chairGraphics.fillRect(0, 0, 16, 16);
    chairGraphics.fillRect(4, 16, 8, 8);
    chairGraphics.lineStyle(1, 0x432121, 1);
    chairGraphics.strokeRect(0, 0, 16, 24);
    chairGraphics.generateTexture('chair', 16, 24);
    chairGraphics.destroy();

    const artFrameGraphics = this.scene.add.graphics();
    artFrameGraphics.fillStyle(0xDAA520, 1);
    artFrameGraphics.fillRect(0, 0, 32, 24);
    artFrameGraphics.lineStyle(2, 0x8B6914, 1);
    artFrameGraphics.strokeRect(1, 1, 30, 22);
    artFrameGraphics.fillStyle(0x87CEEB, 1);
    artFrameGraphics.fillRect(4, 4, 24, 16);
    artFrameGraphics.generateTexture('art-frame', 32, 24);
    artFrameGraphics.destroy();
  }

  getCharacterSprite(role: string): string {
    return `character-${role}`;
  }

  getEnvironmentTile(type: string, variant: number = 0): string {
    switch (type) {
      case 'floor':
        return 'floor';
      case 'wall':
        return 'wall';
      case 'desk':
        return 'desk';
      case 'chair':
        return 'chair';
      default:
        return 'floor';
    }
  }

  isTinyTownAvailable(): boolean {
    // 暂时返回 false，使用默认资源
    return false;
  }
}