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
    const graphics = this.scene.add.graphics();
    const size = 64;
    const halfSize = size / 2;

    // 绘制角色主体
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-halfSize, -size, size, size, 16);
    
    // 添加角色标识
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillRect(-halfSize + 4, -size + 4, size - 8, 16);
    
    // 添加角色文字
    this.scene.add.text(0, -size + 12, role.toUpperCase(), {
      fontSize: '10px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 添加眼睛
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(-halfSize + 12, -size + 24, 6, 6);
    graphics.fillRect(halfSize - 18, -size + 24, 6, 6);

    // 添加嘴巴
    if (role === 'pm') {
      // PM - 微笑
      graphics.lineStyle(2, 0x000000, 1);
      graphics.arc(0, -size + 36, 8, 0.2 * Math.PI, 0.8 * Math.PI);
    } else if (role === 'dev') {
      // Dev - 专注
      graphics.fillRect(-4, -size + 34, 8, 2);
    } else if (role === 'tester') {
      // Tester - 检查
      graphics.lineStyle(2, 0x000000, 1);
      graphics.moveTo(-6, -size + 34);
      graphics.lineTo(6, -size + 34);
      graphics.moveTo(-6, -size + 38);
      graphics.lineTo(6, -size + 38);
    } else {
      // Reviewer - 思考
      graphics.lineStyle(2, 0x000000, 1);
      graphics.arc(0, -size + 36, 8, 0.1 * Math.PI, 0.9 * Math.PI, false);
    }

    const textureName = `character-${role}`;
    graphics.generateTexture(textureName, size, size);
    graphics.destroy();

    // 创建角色动画
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