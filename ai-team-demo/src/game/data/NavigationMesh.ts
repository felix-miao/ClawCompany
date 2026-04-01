import { TILE_SIZE } from '../config/gameConfig';

export interface NavNode {
  x: number;
  y: number;
  isWalkable: boolean;
  isJumpPoint: boolean;
  connections: NavNode[];
}

export interface PlatformNode {
  x: number;
  y: number;
  width: number;
  jumpTargets: PlatformNode[];
}

export class NavigationMesh {
  private nodes: NavNode[][] = [];
  private platformNodes: PlatformNode[] = [];
  private roomConnections: { from: string; to: string; x: number; y: number }[] = [];
  private gridWidth: number;
  private gridHeight: number;

  constructor(width: number, height: number) {
    this.gridWidth = Math.ceil(width / TILE_SIZE);
    this.gridHeight = Math.ceil(height / TILE_SIZE);
    this.initializeGrid();
  }

  private initializeGrid(): void {
    for (let x = 0; x < this.gridWidth; x++) {
      this.nodes[x] = [];
      for (let y = 0; y < this.gridHeight; y++) {
        this.nodes[x][y] = {
          x: x * TILE_SIZE + TILE_SIZE / 2,
          y: y * TILE_SIZE + TILE_SIZE / 2,
          isWalkable: true,
          isJumpPoint: false,
          connections: [],
        };
      }
    }
  }

  setWalkable(x: number, y: number, walkable: boolean): void {
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.nodes[x][y].isWalkable = walkable;
    }
  }

  setJumpPoint(x: number, y: number): void {
    if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
      this.nodes[x][y].isJumpPoint = true;
    }
  }

  addPlatformNode(x: number, y: number, width: number): void {
    const node: PlatformNode = {
      x: x,
      y: y,
      width: width,
      jumpTargets: [],
    };
    this.platformNodes.push(node);
    this.calculateJumpTargets(node);
  }

  private calculateJumpTargets(platform: PlatformNode): void {
    const jumpHeight = 3;
    const jumpDistance = 4;

    this.platformNodes.forEach((target) => {
      if (target === platform) return;

      const dx = Math.abs(target.x - platform.x);
      const dy = platform.y - target.y;

      if (dy > 0 && dy <= jumpHeight * TILE_SIZE && dx <= jumpDistance * TILE_SIZE) {
        platform.jumpTargets.push(target);
      }
    });
  }

  addRoomConnection(from: string, to: string, x: number, y: number): void {
    this.roomConnections.push({ from, to, x, y });
  }

  getNodeAt(gridX: number, gridY: number): NavNode | null {
    if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
      return this.nodes[gridX][gridY];
    }
    return null;
  }

  getNearestWalkableNode(x: number, y: number): NavNode | null {
    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);
    return this.getNodeAt(gridX, gridY);
  }

  getPlatformNodes(): PlatformNode[] {
    return this.platformNodes;
  }

  getRoomConnections(): { from: string; to: string; x: number; y: number }[] {
    return this.roomConnections;
  }

  getGridWidth(): number {
    return this.gridWidth;
  }

  getGridHeight(): number {
    return this.gridHeight;
  }

  static fromTilemap(tilemap: {
    width: number;
    height: number;
    platforms: { x: number; y: number; width: number; height: number }[];
  }): NavigationMesh {
    const mesh = new NavigationMesh(tilemap.width, tilemap.height);

    tilemap.platforms.forEach((platform) => {
      if (platform.height > 0.5) {
        for (let x = Math.floor(platform.x); x < platform.x + platform.width; x++) {
          for (let y = Math.floor(platform.y); y < platform.y + platform.height; y++) {
            mesh.setWalkable(x, y, true);
          }
        }
      } else {
        const left = Math.floor(platform.x);
        const right = Math.floor(platform.x + platform.width - 1);
        const gridY = Math.floor(platform.y);
        for (let x = left; x <= right; x++) {
          mesh.setWalkable(x, gridY, true);
        }
        mesh.addPlatformNode(
          platform.x * TILE_SIZE,
          platform.y * TILE_SIZE,
          platform.width * TILE_SIZE
        );
      }
    });

    return mesh;
  }
}