export type DecorationType =
  | 'plant'
  | 'monitor'
  | 'coffee-cup'
  | 'wall-art'
  | 'bookshelf'
  | 'lamp'
  | 'whiteboard'
  | 'poster';

export interface DecorationConfig {
  width: number;
  height: number;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  zIndex: number;
}

export interface Decoration {
  id: string;
  type: DecorationType;
  x: number;
  y: number;
  config: DecorationConfig;
}

const DECORATION_CONFIGS: Record<DecorationType, DecorationConfig> = {
  plant: { width: 16, height: 24, primaryColor: 0x2d5016, secondaryColor: 0x4a7c23, accentColor: 0x8b6914, zIndex: 5 },
  monitor: { width: 20, height: 16, primaryColor: 0x333333, secondaryColor: 0x1a1a2e, accentColor: 0x00ff88, zIndex: 6 },
  'coffee-cup': { width: 8, height: 10, primaryColor: 0xffffff, secondaryColor: 0x8b6914, accentColor: 0xddd, zIndex: 7 },
  'wall-art': { width: 24, height: 18, primaryColor: 0x1a1a2e, secondaryColor: 0x3b82f6, accentColor: 0xf59e0b, zIndex: 2 },
  bookshelf: { width: 28, height: 32, primaryColor: 0x5c3a1e, secondaryColor: 0x8b6914, accentColor: 0xef4444, zIndex: 3 },
  lamp: { width: 12, height: 20, primaryColor: 0x666666, secondaryColor: 0xffdd00, accentColor: 0x999999, zIndex: 5 },
  whiteboard: { width: 32, height: 20, primaryColor: 0xffffff, secondaryColor: 0xe5e5e5, accentColor: 0x333333, zIndex: 2 },
  poster: { width: 20, height: 28, primaryColor: 0x1e3a5f, secondaryColor: 0xff6b6b, accentColor: 0xffffff, zIndex: 2 },
};

let decorationIdCounter = 0;

export class OfficeDecorator {
  private decorations: Map<string, Decoration> = new Map();

  getAvailableDecorationTypes(): DecorationType[] {
    return Object.keys(DECORATION_CONFIGS) as DecorationType[];
  }

  getDecorationConfig(type: DecorationType): DecorationConfig | null {
    return DECORATION_CONFIGS[type] ?? null;
  }

  getDecorationCount(): number {
    return this.decorations.size;
  }

  createDecoration(type: DecorationType, x: number, y: number): string | null {
    const config = DECORATION_CONFIGS[type];
    if (!config) return null;

    const id = `deco_${++decorationIdCounter}_${Date.now()}`;
    this.decorations.set(id, { id, type, x, y, config });
    return id;
  }

  removeDecoration(id: string): void {
    this.decorations.delete(id);
  }

  removeAllDecorations(): void {
    this.decorations.clear();
  }

  getDecorations(): Decoration[] {
    return Array.from(this.decorations.values());
  }

  getDecorationsByType(type: DecorationType): Decoration[] {
    return Array.from(this.decorations.values()).filter(d => d.type === type);
  }

  autoDecorate(
    platforms: Array<{ x: number; y: number; width: number; height: number; type: string }>,
    _mapWidth: number,
    _mapHeight: number
  ): void {
    if (platforms.length === 0) return;

    const TILE = 32;

    for (const platform of platforms) {
      if (platform.type === 'desk') {
        const deskCenterX = (platform.x + platform.width / 2) * TILE;
        const deskTopY = platform.y * TILE - 2;

        this.createDecoration('monitor', deskCenterX - 8, deskTopY - 16);
        this.createDecoration('coffee-cup', deskCenterX + platform.width * TILE / 4, deskTopY - 10);
      }

      if (platform.type === 'wall_left' || platform.type === 'wall_right') {
        const wallX = platform.type === 'wall_left'
          ? (platform.x + 1) * TILE
          : platform.x * TILE - TILE;

        this.createDecoration('wall-art', wallX + 16, 4 * TILE);

        if (Math.random() > 0.5) {
          this.createDecoration('poster', wallX + 16, 8 * TILE);
        }
      }

      if (platform.type === 'floor') {
        this.createDecoration('plant', (platform.x + 1) * TILE, platform.y * TILE - 24);
        this.createDecoration('plant', (platform.x + platform.width - 2) * TILE, platform.y * TILE - 24);

        if (platform.width >= 15) {
          this.createDecoration('bookshelf', (platform.x + 3) * TILE, platform.y * TILE - 32);
        }

        if (Math.random() > 0.4) {
          this.createDecoration('whiteboard', (platform.x + platform.width / 2) * TILE, 2 * TILE);
        }

        this.createDecoration('lamp', (platform.x + platform.width / 2) * TILE + 48, platform.y * TILE - 20);
      }
    }
  }

  destroy(): void {
    this.removeAllDecorations();
  }
}
