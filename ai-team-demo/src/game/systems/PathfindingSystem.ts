import Phaser from 'phaser';
import { NavigationMesh, PlatformNode } from '../data/NavigationMesh';
import { TILE_SIZE } from '../config/gameConfig';
import { MinHeap } from './MinHeap';

export interface PathPoint {
  x: number;
  y: number;
  action: 'move' | 'jump' | 'fall';
}

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class PathfindingSystem {
  private scene: Phaser.Scene;
  private navMesh: NavigationMesh;
  private path: PathPoint[] = [];
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, navMesh: NavigationMesh) {
    this.scene = scene;
    this.navMesh = navMesh;
  }

  findPath(startX: number, startY: number, endX: number, endY: number): PathPoint[] {
    const startGridX = Math.floor(startX / TILE_SIZE);
    const startGridY = Math.floor(startY / TILE_SIZE);
    const endGridX = Math.floor(endX / TILE_SIZE);
    const endGridY = Math.floor(endY / TILE_SIZE);

    const platformPath = this.findPlatformPath(startX, startY, endX, endY);
    
    if (platformPath.length > 0) {
      this.path = this.smoothPath(platformPath);
      return this.path;
    }

    const gridPath = this.findGridPath(startGridX, startGridY, endGridX, endGridY);
    this.path = gridPath;
    return this.path;
  }

  private findPlatformPath(startX: number, startY: number, endX: number, endY: number): PathPoint[] {
    const platformNodes = this.navMesh.getPlatformNodes();
    
    const startPlatform = this.findNearestPlatform(startX, startY, platformNodes);
    const endPlatform = this.findNearestPlatform(endX, endY, platformNodes);

    if (!startPlatform || !endPlatform) {
      return [];
    }

    if (startPlatform === endPlatform) {
      return [{ x: endX, y: endY, action: 'move' }];
    }

    const visited = new Set<PlatformNode>();
    const queue: { platform: PlatformNode; path: PathPoint[] }[] = [
      { platform: startPlatform, path: [{ x: startPlatform.x, y: startPlatform.y, action: 'move' }] }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentPlatform = current.platform;

      if (visited.has(currentPlatform)) continue;
      visited.add(currentPlatform);

      if (currentPlatform === endPlatform) {
        const finalPath = [...current.path];
        finalPath.push({ x: endX, y: endY, action: 'move' });
        return finalPath;
      }

      for (const jumpTarget of currentPlatform.jumpTargets) {
        if (!visited.has(jumpTarget)) {
          const newPath: PathPoint[] = [...current.path, { x: jumpTarget.x, y: jumpTarget.y, action: 'jump' as const }];
          queue.push({ platform: jumpTarget, path: newPath });
        }
      }

      for (const platform of platformNodes) {
        if (!visited.has(platform) && platform !== currentPlatform) {
          const dx = Math.abs(platform.x - currentPlatform.x);
          const dy = platform.y - currentPlatform.y;
          
          if (dy === 0 && dx <= currentPlatform.width / TILE_SIZE) {
            const newPath: PathPoint[] = [...current.path, { x: platform.x, y: platform.y, action: 'move' as const }];
            queue.push({ platform: platform, path: newPath });
          }
        }
      }
    }

    return [];
  }

  private findNearestPlatform(x: number, y: number, platforms: PlatformNode[]): PlatformNode | null {
    let nearest: PlatformNode | null = null;
    let minDist = Infinity;

    for (const platform of platforms) {
      const dx = Math.abs(platform.x - x);
      const dy = Math.abs(platform.y - y);
      const dist = dx + dy;

      if (dy <= TILE_SIZE && dx <= platform.width / 2 && dist < minDist) {
        minDist = dist;
        nearest = platform;
      }
    }

    return nearest;
  }

  private findGridPath(startX: number, startY: number, endX: number, endY: number): PathPoint[] {
    const openHeap = new MinHeap<PathNode>((a, b) => a.f - b.f);
    const closedSet = new Set<string>();
    const openMap = new Map<string, PathNode>();

    const startKey = `${startX},${startY}`;
    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: this.heuristic(startX, startY, endX, endY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openHeap.push(startNode);
    openMap.set(startKey, startNode);

    while (openHeap.size() > 0) {
      const current = openHeap.pop()!;
      const currentKey = `${current.x},${current.y}`;

      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }

      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);
      openMap.delete(currentKey);

      const neighbors = this.getNeighbors(current.x, current.y);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;
        if (closedSet.has(neighborKey)) continue;

        const node = this.navMesh.getNodeAt(neighbor.x, neighbor.y);
        if (!node || !node.isWalkable) continue;

        const tentativeG = current.g + 1;
        const existingNode = openMap.get(neighborKey);

        if (!existingNode) {
          const newNode: PathNode = {
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h: this.heuristic(neighbor.x, neighbor.y, endX, endY),
            f: 0,
            parent: current,
          };
          newNode.f = newNode.g + newNode.h;
          openHeap.push(newNode);
          openMap.set(neighborKey, newNode);
        } else if (tentativeG < existingNode.g) {
          const updated: PathNode = {
            ...existingNode,
            g: tentativeG,
            f: tentativeG + existingNode.h,
            parent: current,
          };
          openHeap.decreaseKey(updated, (item) => item.x === neighbor.x && item.y === neighbor.y);
          openMap.set(neighborKey, updated);
        }
      }
    }

    return [];
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  private getNeighbors(x: number, y: number): { x: number; y: number }[] {
    const neighbors = [
      { x: x + 1, y: y },
      { x: x - 1, y: y },
      { x: x, y: y + 1 },
      { x: x, y: y - 1 },
    ];

    return neighbors.filter(n => {
      const node = this.navMesh.getNodeAt(n.x, n.y);
      return node && node.isWalkable;
    });
  }

  private reconstructPath(node: PathNode): PathPoint[] {
    const path: PathPoint[] = [];
    let current: PathNode | null = node;

    while (current) {
      path.unshift({
        x: current.x * TILE_SIZE + TILE_SIZE / 2,
        y: current.y * TILE_SIZE + TILE_SIZE / 2,
        action: 'move',
      });
      current = current.parent;
    }

    return path;
  }

  private smoothPath(path: PathPoint[]): PathPoint[] {
    if (path.length <= 2) return path;

    const smoothed: PathPoint[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = smoothed[smoothed.length - 1];
      const current = path[i];
      const next = path[i + 1];

      const dx1 = current.x - prev.x;
      const dy1 = current.y - prev.y;
      const dx2 = next.x - current.x;
      const dy2 = next.y - current.y;

      if (current.action === 'jump' || Math.sign(dx1) !== Math.sign(dx2)) {
        smoothed.push(current);
      }
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  getCurrentPath(): PathPoint[] {
    return this.path;
  }

  drawDebug(visible: boolean): void {
    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
    }
    this.debugGraphics.clear();
    this.debugGraphics.setVisible(visible);

    if (!visible || this.path.length === 0) return;

    this.debugGraphics.lineStyle(2, 0x00ff00, 1);
    
    for (let i = 0; i < this.path.length - 1; i++) {
      const point = this.path[i];
      const nextPoint = this.path[i + 1];
      this.debugGraphics.lineBetween(point.x, point.y, nextPoint.x, nextPoint.y);
    }

    this.path.forEach((point, index) => {
      const color = point.action === 'jump' ? 0xff0000 : 0x00ff00;
      this.debugGraphics!.fillStyle(color, 1);
      this.debugGraphics!.fillCircle(point.x, point.y, 5);
    });
  }
}