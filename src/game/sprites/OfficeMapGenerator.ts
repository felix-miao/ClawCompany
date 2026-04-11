import Phaser from 'phaser';
import { TinyTownLoader } from './TinyTownLoader';
import type { Platform, Workstation } from '../types/OfficeTypes';

interface OfficeMapConfig {
  width: number;
  height: number;
  tileSize: number;
}

export interface OfficeRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'office' | 'meeting' | 'development' | 'testing' | 'review';
  decoration?: string[];
}

export interface OfficeDecoration {
  id: string;
  type: 'plant' | 'computer' | 'window' | 'door' | 'art' | 'bookshelf';
  x: number;
  y: number;
  width: number;
  height: number;
}

export class OfficeMapGenerator {
  private scene: Phaser.Scene;
  private tinyTownLoader: TinyTownLoader;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.tinyTownLoader = new TinyTownLoader(scene);
  }

  async generateOffice(): Promise<{
    platforms: Platform[];
    decorations: OfficeDecoration[];
    rooms: OfficeRoom[];
    workstations: Workstation[];
  }> {
    // 先加载 Tiny Town 资源
    await this.tinyTownLoader.loadResources();
    
    const officeConfig = this.getOfficeConfig();
    const platforms = this.generatePlatforms(officeConfig);
    const decorations = this.generateDecorations(officeConfig);
    const rooms = this.generateRooms(officeConfig);
    const workstations = this.generateWorkstations(officeConfig);
    
    return {
      platforms,
      decorations,
      rooms,
      workstations
    };
  }

  private getOfficeConfig(): OfficeMapConfig {
    return {
      width: 20,
      height: 15,
      tileSize: 32
    };
  }

  private generatePlatforms(config: OfficeMapConfig): Platform[] {
    const platforms: Platform[] = [];
    
    // 外墙
    platforms.push(
      { x: 0, y: 0, width: 1, height: config.height, type: 'wall_outer' },
      { x: config.width - 1, y: 0, width: 1, height: config.height, type: 'wall_outer' },
      { x: 0, y: 0, width: config.width, height: 1, type: 'wall_outer' },
      { x: 0, y: config.height - 1, width: config.width, height: 1, type: 'wall_outer' }
    );

    // 内墙 - 创建办公室隔间
    platforms.push(
      // 左侧会议室墙壁
      { x: 2, y: 2, width: 1, height: 5, type: 'wall_inner' },
      { x: 2, y: 7, width: 1, height: 5, type: 'wall_inner' },
      { x: 2, y: 2, width: 6, height: 1, type: 'wall_inner' },
      
      // 右侧开发室墙壁
      { x: 12, y: 2, width: 1, height: 6, type: 'wall_inner' },
      { x: 12, y: 8, width: 1, height: 6, type: 'wall_inner' },
      { x: 12, y: 2, width: 7, height: 1, type: 'wall_inner' },
      
      // 中间走廊墙壁
      { x: 8, y: 2, width: 1, height: 11, type: 'wall_inner' },
      
      // 下侧测试室和评审室墙壁
      { x: 2, y: 12, width: 1, height: 2, type: 'wall_inner' },
      { x: 2, y: 10, width: 6, height: 1, type: 'wall_inner' },
      
      { x: 10, y: 12, width: 1, height: 2, type: 'wall_inner' },
      { x: 10, y: 10, width: 9, height: 1, type: 'wall_inner' }
    );

    // 办公桌
    platforms.push(
      // 会议室桌子
      { x: 3, y: 4, width: 4, height: 1, type: 'desk' },
      { x: 4, y: 6, width: 2, height: 1, type: 'desk' },
      
      // 开发室桌子
      { x: 13, y: 3, width: 4, height: 1, type: 'desk' },
      { x: 14, y: 5, width: 3, height: 1, type: 'desk' },
      { x: 13, y: 7, width: 4, height: 1, type: 'desk' },
      
      // 测试室桌子
      { x: 3, y: 12, width: 3, height: 1, type: 'desk' },
      { x: 4, y: 11, width: 2, height: 1, type: 'desk' },
      
      // 评审室桌子
      { x: 11, y: 12, width: 3, height: 1, type: 'desk' },
      { x: 12, y: 11, width: 2, height: 1, type: 'desk' }
    );

    // 椅子
    platforms.push(
      { x: 3, y: 3, width: 1, height: 1, type: 'chair' },
      { x: 6, y: 3, width: 1, height: 1, type: 'chair' },
      { x: 4, y: 5, width: 1, height: 1, type: 'chair' },
      
      { x: 13, y: 2, width: 1, height: 1, type: 'chair' },
      { x: 16, y: 2, width: 1, height: 1, type: 'chair' },
      { x: 14, y: 4, width: 1, height: 1, type: 'chair' },
      { x: 15, y: 6, width: 1, height: 1, type: 'chair' },
      { x: 13, y: 6, width: 1, height: 1, type: 'chair' },
      
      { x: 3, y: 11, width: 1, height: 1, type: 'chair' },
      { x: 5, y: 11, width: 1, height: 1, type: 'chair' },
      { x: 4, y: 10, width: 1, height: 1, type: 'chair' },
      
      { x: 11, y: 11, width: 1, height: 1, type: 'chair' },
      { x: 13, y: 11, width: 1, height: 1, type: 'chair' },
      { x: 12, y: 10, width: 1, height: 1, type: 'chair' }
    );

    return platforms;
  }

  private generateDecorations(config: OfficeMapConfig): OfficeDecoration[] {
    const decorations: OfficeDecoration[] = [];
    
    // 植物
    decorations.push(
      { id: 'plant1', type: 'plant', x: 1, y: 1, width: 1, height: 1 },
      { id: 'plant2', type: 'plant', x: 18, y: 1, width: 1, height: 1 },
      { id: 'plant3', type: 'plant', x: 1, y: 13, width: 1, height: 1 },
      { id: 'plant4', type: 'plant', x: 18, y: 13, width: 1, height: 1 }
    );

    // 窗户
    decorations.push(
      { id: 'window1', type: 'window', x: 5, y: 0, width: 3, height: 1 },
      { id: 'window2', type: 'window', x: 12, y: 0, width: 3, height: 1 },
      { id: 'window3', type: 'window', x: 5, y: 14, width: 3, height: 1 },
      { id: 'window4', type: 'window', x: 12, y: 14, width: 3, height: 1 }
    );

    // 电脑
    decorations.push(
      { id: 'computer1', type: 'computer', x: 4, y: 4, width: 1, height: 1 },
      { id: 'computer2', type: 'computer', x: 14, y: 3, width: 1, height: 1 },
      { id: 'computer3', type: 'computer', x: 14, y: 7, width: 1, height: 1 },
      { id: 'computer4', type: 'computer', x: 4, y: 12, width: 1, height: 1 },
      { id: 'computer5', type: 'computer', x: 12, y: 12, width: 1, height: 1 }
    );

    // 艺术装饰
    decorations.push(
      { id: 'art1', type: 'art', x: 8, y: 2, width: 1, height: 2 },
      { id: 'art2', type: 'art', x: 8, y: 11, width: 1, height: 2 }
    );

    // 书架
    decorations.push(
      { id: 'bookshelf1', type: 'bookshelf', x: 1, y: 4, width: 1, height: 2 },
      { id: 'bookshelf2', type: 'bookshelf', x: 18, y: 4, width: 1, height: 2 }
    );

    return decorations;
  }

  private generateRooms(config: OfficeMapConfig): OfficeRoom[] {
    return [
      {
        id: 'meeting-room',
        name: '会议室',
        x: 3,
        y: 3,
        width: 5,
        height: 4,
        type: 'meeting',
        decoration: ['plant', 'window', 'art']
      },
      {
        id: 'dev-studio',
        name: '开发室',
        x: 13,
        y: 3,
        width: 6,
        height: 5,
        type: 'development',
        decoration: ['plant', 'computer', 'bookshelf']
      },
      {
        id: 'test-lab',
        name: '测试室',
        x: 3,
        y: 11,
        width: 5,
        height: 3,
        type: 'testing',
        decoration: ['computer', 'plant']
      },
      {
        id: 'review-center',
        name: '评审中心',
        x: 11,
        y: 11,
        width: 5,
        height: 3,
        type: 'review',
        decoration: ['computer', 'window', 'art']
      }
    ];
  }

  private generateWorkstations(config: OfficeMapConfig): Workstation[] {
    return [
      { id: 'ws1', x: 5, y: 4, label: 'PM', status: 'idle' as const, taskType: 'meeting' },
      { id: 'ws2', x: 14, y: 4, label: 'Dev1', status: 'idle' as const, taskType: 'coding' },
      { id: 'ws3', x: 15, y: 7, label: 'Dev2', status: 'idle' as const, taskType: 'testing' },
      { id: 'ws4', x: 4, y: 12, label: 'Tester', status: 'idle' as const, taskType: 'testing' },
      { id: 'ws5', x: 12, y: 12, label: 'Reviewer', status: 'idle' as const, taskType: 'review' }
    ];
  }

  renderDecorations(decorations: OfficeDecoration[]): void {
    decorations.forEach(decoration => {
      const asset = this.getDecorationAsset(decoration.type);
      const sprite = this.scene.add.image(
        decoration.x * 32 + 16,
        decoration.y * 32 + 16,
        asset
      );
      sprite.setOrigin(0.5);
      sprite.setDepth(decoration.y + 1);
    });
  }

  public getDecorationAsset(type: string): string {
    switch (type) {
      case 'plant':
        return this.tinyTownLoader.getEnvironmentTile('plant', 0);
      case 'computer':
        return this.tinyTownLoader.getEnvironmentTile('computer', 0);
      case 'window':
        return this.tinyTownLoader.getEnvironmentTile('window', 0);
      case 'door':
        return this.tinyTownLoader.getEnvironmentTile('door', 0);
      case 'art':
        return 'art-frame';
      case 'bookshelf':
        return this.tinyTownLoader.getEnvironmentTile('wall', 0);
      default:
        return 'floor';
    }
  }

  createOfficeBackground(): void {
    // No-op: background is handled by drawOfficeBackground() in OfficeScene
    // and by the Phaser backgroundColor config (#1a1a2e).
    // We intentionally do NOT draw a light-gray fill here as it would
    // overwrite the dark background.
  }
}