import Phaser from 'phaser';
import { PathfindingSystem, PathPoint } from './PathfindingSystem';
import { NavigationMesh } from '../data/NavigationMesh';
import { TILE_SIZE } from '../config/gameConfig';

export interface NavigationResult {
  success: boolean;
  path: PathPoint[];
}

export class NavigationSystem {
  private scene: Phaser.Scene;
  private pathfindingSystem: PathfindingSystem;
  private navMesh: NavigationMesh;

  constructor(scene: Phaser.Scene, navMesh: NavigationMesh) {
    this.scene = scene;
    this.navMesh = navMesh;
    this.pathfindingSystem = new PathfindingSystem(scene, navMesh);
  }

  calculatePath(startX: number, startY: number, endX: number, endY: number): NavigationResult {
    const path = this.pathfindingSystem.findPath(startX, startY, endX, endY);
    
    if (path.length === 0) {
      return { success: false, path: [] };
    }

    return { success: true, path };
  }

  isWalkable(x: number, y: number): boolean {
    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);
    const node = this.navMesh.getNodeAt(gridX, gridY);
    return node?.isWalkable ?? false;
  }

  findNearestWalkablePosition(x: number, y: number): { x: number; y: number } | null {
    const directions = [
      { dx: 0, dy: 0 },
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
      { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
    ];

    for (const dir of directions) {
      const checkX = x + dir.dx * TILE_SIZE;
      const checkY = y + dir.dy * TILE_SIZE;
      
      if (this.isWalkable(checkX, checkY)) {
        return { x: checkX, y: checkY };
      }
    }

    return null;
  }

  getPathfindingSystem(): PathfindingSystem {
    return this.pathfindingSystem;
  }

  setDebugVisible(visible: boolean): void {
    this.pathfindingSystem.drawDebug(visible);
  }
}