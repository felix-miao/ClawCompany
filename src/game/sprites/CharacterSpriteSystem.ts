import * as Phaser from 'phaser';
import { TinyTownLoader } from './TinyTownLoader';

export class CharacterSpriteSystem {
  private scene: Phaser.Scene;
  private spritesheets: Map<string, Phaser.Textures.Texture> = new Map();
  private tinyTownLoader: TinyTownLoader | null = null;
  private isInitialized: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('🎨 初始化角色精灵系统...');
    
    // 创建 Tiny Town 加载器
    this.tinyTownLoader = new TinyTownLoader(this.scene);
    
    // 加载资源
    await this.loadSpritesheets();
    
    this.isInitialized = true;
    console.log('✅ 角色精灵系统初始化完成');
  }

  private async loadSpritesheets(): Promise<void> {
    try {
      // 首先尝试加载 Tiny Town 资源
      if (this.tinyTownLoader) {
        await this.tinyTownLoader.loadResources();
      }
      
      this.loadCharacterSprites();
      this.loadOfficeEnvironment();
    } catch (error) {
      console.warn('精灵加载失败，使用默认方案:', error);
      this.createDefaultCharacterSprites();
      this.createDefaultOfficeAssets();
    }
  }

  private loadCharacterSprites(): void {
    if (this.tinyTownLoader && this.tinyTownLoader.isTinyTownAvailable()) {
      console.log('🎭 使用 Tiny Town 角色精灵');
      return; // Tiny Town 已经处理了角色精灵
    }
    
    // 后备方案：创建默认角色精灵
    console.log('🎨 创建默认角色精灵');
    this.createDefaultCharacterSprites();
  }

  private loadOfficeEnvironment(): void {
    if (this.tinyTownLoader && this.tinyTownLoader.isTinyTownAvailable()) {
      console.log('🏢 使用 Tiny Town 环境资源');
      return; // Tiny Town 已经处理了环境资源
    }
    
    // 后备方案：创建默认环境资源
    console.log('🏗️ 创建默认环境资源');
    this.createDefaultOfficeAssets();
  }

  private createDefaultCharacterSprites(): void {
    // 创建默认角色精灵，带有更好的视觉设计
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4];
    const roles = ['PM', 'Dev', 'Tester', 'Reviewer'];

    colors.forEach((color, index) => {
      this.createRoleCharacterSprite(color, roles[index], index);
    });
  }

  private createRoleCharacterSprite(color: number, role: string, index: number): void {
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
    this.scene.add.text(0, -size + 12, role, {
      fontSize: '12px',
      color: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // 添加眼睛
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(-halfSize + 12, -size + 24, 6, 6);
    graphics.fillRect(halfSize - 18, -size + 24, 6, 6);

    // 添加嘴巴
    if (index === 0) { // PM - 微笑
      graphics.lineStyle(2, 0x000000, 1);
      graphics.arc(0, -size + 36, 8, 0.2 * Math.PI, 0.8 * Math.PI);
    } else if (index === 1) { // Dev - 专注
      graphics.fillRect(-4, -size + 34, 8, 2);
    } else if (index === 2) { // Tester - 检查
      graphics.lineStyle(2, 0x000000, 1);
      graphics.moveTo(-6, -size + 34);
      graphics.lineTo(6, -size + 34);
      graphics.moveTo(-6, -size + 38);
      graphics.lineTo(6, -size + 38);
    } else { // Reviewer - 思考
      graphics.lineStyle(2, 0x000000, 1);
      graphics.arc(0, -size + 36, 8, 0.1 * Math.PI, 0.9 * Math.PI, false);
    }

    const textureName = `character_${role.toLowerCase()}`;
    graphics.generateTexture(textureName, size, size);
    graphics.destroy();

    // 创建动画
    this.createCharacterAnimations(textureName, role);
  }

  private createCharacterAnimations(textureName: string, role: string): void {
    // 创建角色动画
    const walkFrames = [];
    for (let i = 0; i < 4; i++) {
      walkFrames.push({ key: textureName, frame: i });
    }

    this.scene.anims.create({
      key: `${role.toLowerCase()}_walk`,
      frames: walkFrames,
      frameRate: 8,
      repeat: -1
    });

    const idleFrames = [];
    for (let i = 0; i < 2; i++) {
      idleFrames.push({ key: textureName, frame: i });
    }

    this.scene.anims.create({
      key: `${role.toLowerCase()}_idle`,
      frames: idleFrames,
      frameRate: 2,
      repeat: -1
    });

    const workFrames = [];
    for (let i = 0; i < 3; i++) {
      workFrames.push({ key: textureName, frame: i });
    }

    this.scene.anims.create({
      key: `${role.toLowerCase()}_work`,
      frames: workFrames,
      frameRate: 6,
      repeat: -1
    });
  }

  private createDefaultCharacterSprite(index: number): void {
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4];
    const roles = ['PM', 'Dev', 'Tester', 'Reviewer'];
    
    if (index < colors.length) {
      this.createRoleCharacterSprite(colors[index], roles[index], index);
    }
  }

  private createDefaultOfficeAssets(): void {
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
  }

  getCharacterSprite(role: string): string {
    if (this.tinyTownLoader) {
      return this.tinyTownLoader.getCharacterSprite(role.toLowerCase());
    }
    return `character-${role.toLowerCase()}`;
  }

  getOfficeAsset(type: string): string {
    if (this.tinyTownLoader) {
      return this.tinyTownLoader.getEnvironmentTile(type);
    }
    
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

  createEnhancedOfficeMap(): { width: number; height: number; tileSize: number; layers: { name: string; data: number[][] }[]; objects: { name: string; x: number; y: number; width: number; height: number; type: string }[] } {
    // 创建增强的办公室地图
    return {
      width: 20,
      height: 15,
      tileSize: 32,
      layers: [
        {
          name: 'background',
          data: this.createBackgroundLayer(),
        },
        {
          name: 'floor',
          data: this.createFloorLayer(),
        },
        {
          name: 'furniture',
          data: this.createFurnitureLayer(),
        }
      ],
      objects: [
        {
          name: 'pm-office',
          x: 4,
          y: 6,
          width: 3,
          height: 3,
          type: 'room'
        },
        {
          name: 'dev-studio',
          x: 12,
          y: 6,
          width: 4,
          height: 3,
          type: 'room'
        },
        {
          name: 'test-lab',
          x: 4,
          y: 10,
          width: 3,
          height: 3,
          type: 'room'
        },
        {
          name: 'review-center',
          x: 12,
          y: 10,
          width: 3,
          height: 3,
          type: 'room'
        }
      ]
    };
  }

  private createBackgroundLayer(): number[][] {
    const layer = [];
    for (let y = 0; y < 15; y++) {
      const row = [];
      for (let x = 0; x < 20; x++) {
        if (y === 0 || y === 14 || x === 0 || x === 19) {
          row.push(1); // 墙壁
        } else {
          row.push(0); // 空气
        }
      }
      layer.push(row);
    }
    return layer;
  }

  private createFloorLayer(): number[][] {
    const layer = [];
    for (let y = 0; y < 15; y++) {
      const row = [];
      for (let x = 0; x < 20; x++) {
        if (y >= 13) {
          row.push(2); // 地板
        } else {
          row.push(0); // 空
        }
      }
      layer.push(row);
    }
    return layer;
  }

  private createFurnitureLayer(): number[][] {
    const layer = [];
    for (let y = 0; y < 15; y++) {
      const row = [];
      for (let x = 0; x < 20; x++) {
        // 办公桌
        if ((x >= 2 && x <= 4 && y === 8) ||
            (x >= 6 && x <= 8 && y === 8) ||
            (x >= 10 && x <= 12 && y === 8) ||
            (x >= 14 && x <= 16 && y === 8)) {
          row.push(3); // 桌子
        } else if ((x >= 1 && x <= 5 && y === 6) ||
                   (x >= 9 && x <= 13 && y === 6) ||
                   (x >= 1 && x <= 5 && y === 10) ||
                   (x >= 11 && x <= 15 && y === 10)) {
          row.push(4); // 房间
        } else {
          row.push(0); // 空
        }
      }
      layer.push(row);
    }
    return layer;
  }
}