import * as Phaser from 'phaser';

import { PathfindingSystem, PathPoint } from './PathfindingSystem';
import { PHYSICS_CONFIG } from '../config/gameConfig';

export type NavigationState = 'idle' | 'moving' | 'jumping' | 'arrived';

export interface NavigationTask {
  id: string;
  targetX: number;
  targetY: number;
  onArrival?: () => void;
  priority: number;
}

export class NavigationController {
  private scene: Phaser.Scene;
  private agent: Phaser.Physics.Arcade.Sprite;
  private pathfindingSystem: PathfindingSystem;
  private state: NavigationState = 'idle';
  private currentPath: PathPoint[] = [];
  private currentPathIndex: number = 0;
  private targetPosition: { x: number; y: number } | null = null;
  private arrivalCallback: (() => void) | null = null;
  private arrivalThreshold: number = 20;
  private taskQueue: NavigationTask[] = [];
  private isProcessingQueue: boolean = false;
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugVisible: boolean = false;

  constructor(
    scene: Phaser.Scene,
    agent: Phaser.Physics.Arcade.Sprite,
    pathfindingSystem: PathfindingSystem
  ) {
    this.scene = scene;
    this.agent = agent;
    this.pathfindingSystem = pathfindingSystem;
  }

  setTarget(x: number, y: number, onArrival?: () => void): void {
    this.targetPosition = { x, y };
    this.arrivalCallback = onArrival || null;

    this.pathfindingSystem.findPath(this.agent.x, this.agent.y, x, y);
    this.currentPath = this.pathfindingSystem.getCurrentPath();
    this.currentPathIndex = 0;
    this.state = 'moving';
  }

  addTask(task: NavigationTask): void {
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    if (!this.isProcessingQueue) {
      this.processNextTask();
    }
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const task = this.taskQueue.shift()!;
    this.setTarget(task.targetX, task.targetY, () => {
      task.onArrival?.();
      this.processNextTask();
    });
  }

  update(): void {
    if (this.state !== 'moving' || this.currentPath.length === 0) {
      return;
    }

    const nextPoint = this.currentPath[this.currentPathIndex];
    if (!nextPoint) {
      this.state = 'arrived';
      this.onArrived();
      return;
    }

    const dx = nextPoint.x - this.agent.x;
    const dy = nextPoint.y - this.agent.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.arrivalThreshold) {
      this.handlePointArrival(nextPoint);
      return;
    }

    const direction = dx > 0 ? 1 : -1;
    const body = this.agent.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(direction * PHYSICS_CONFIG.moveSpeed);

    if (nextPoint.action === 'jump' && body.blocked.down) {
      const jumpDistance = Math.sqrt(
        Math.pow(nextPoint.x - this.agent.x, 2) +
        Math.pow(nextPoint.y - this.agent.y, 2)
      );
      if (jumpDistance < 80) {
        body.setVelocityY(-PHYSICS_CONFIG.jumpForce);
        this.state = 'jumping';
      }
    }

    this.agent.flipX = dx < 0;
  }

  private handlePointArrival(point: PathPoint): void {
    if (point.action === 'jump' && this.isOnFloor()) {
      const body = this.agent.body as Phaser.Physics.Arcade.Body;
      body.setVelocityY(-PHYSICS_CONFIG.jumpForce);
      this.state = 'jumping';
    }

    this.currentPathIndex++;

    if (this.currentPathIndex >= this.currentPath.length) {
      this.state = 'arrived';
      this.onArrived();
    }
  }

  private onArrived(): void {
    this.state = 'idle';
    const body = this.agent.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);
    this.arrivalCallback?.();
    this.arrivalCallback = null;
  }

  private isOnFloor(): boolean {
    const body = this.agent.body as Phaser.Physics.Arcade.Body;
    return body?.blocked.down || body?.touching.down || false;
  }

  getState(): NavigationState {
    return this.state;
  }

  getTargetPosition(): { x: number; y: number } | null {
    return this.targetPosition;
  }

  isNavigating(): boolean {
    return this.state === 'moving' || this.state === 'jumping';
  }

  clearQueue(): void {
    this.taskQueue = [];
    this.isProcessingQueue = false;
  }

  getQueueLength(): number {
    return this.taskQueue.length;
  }

  setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    if (this.debugGraphics) {
      this.debugGraphics.setVisible(visible);
    }
  }

  drawDebug(): void {
    if (!this.debugVisible) return;

    if (!this.debugGraphics) {
      this.debugGraphics = this.scene.add.graphics();
    }

    this.debugGraphics.clear();

    if (this.targetPosition) {
      this.debugGraphics.fillStyle(0xffff00, 0.5);
      this.debugGraphics.fillCircle(this.targetPosition.x, this.targetPosition.y, 10);
    }

    if (this.currentPath.length > 0) {
      this.debugGraphics.lineStyle(2, 0x00ff00, 1);
      
      for (let i = 0; i < this.currentPath.length - 1; i++) {
        const point = this.currentPath[i];
        const nextPoint = this.currentPath[i + 1];
        this.debugGraphics.lineBetween(point.x, point.y, nextPoint.x, nextPoint.y);
      }

      this.currentPath.forEach((point, index) => {
        const color = point.action === 'jump' ? 0xff0000 : 0x00ff00;
        this.debugGraphics!.fillStyle(color, 1);
        this.debugGraphics!.fillCircle(point.x, point.y, 4);
      });
    }
  }
}