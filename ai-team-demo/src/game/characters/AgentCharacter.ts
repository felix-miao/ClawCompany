import Phaser from 'phaser';
import { PHYSICS_CONFIG } from '../config/gameConfig';
import { AnimationController, AnimationState } from '../systems/AnimationController';
import { PathfindingSystem, PathPoint } from '../systems/PathfindingSystem';

type NavigationState = 'idle' | 'moving' | 'jumping' | 'arrived';

export class AgentCharacter extends Phaser.Physics.Arcade.Sprite {
  private isOnFloor: boolean = false;
  private animationController!: AnimationController;
  private color: number;
  private isWorking: boolean = false;
  private pathfindingSystem: PathfindingSystem | null = null;
  private targetPosition: { x: number; y: number } | null = null;
  private originalPosition: { x: number; y: number } | null = null;
  private isNavigating: boolean = false;
  private arrivalThreshold: number = 10;
  private navigationState: NavigationState = 'idle';
  private currentPath: PathPoint[] = [];
  private arrivalCallback: (() => void) | null = null;
  private onArrivalCallbacks: (() => void)[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    frame?: string | number,
    color: number = 0xffffff
  ) {
    super(scene, x, y, texture, frame);

    this.color = color;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setDrag(PHYSICS_CONFIG.drag, 0);
  }

  setAnimationController(controller: AnimationController): void {
    this.animationController = controller;
  }

  update(): void {
    if (this.animationController) {
      const velocityX = this.body?.velocity.x || 0;
      const velocityY = this.body?.velocity.y || 0;
      this.animationController.update(
        velocityX,
        velocityY,
        this.getOnFloor(),
        this.isWorking
      );
    }

    if (this.isNavigating) {
      this.updateNavigation();
    }
  }

  getOnFloor(): boolean {
    return this.body?.blocked.down || this.body?.touching.down || false;
  }

  setWorking(working: boolean): void {
    this.isWorking = working;
  }

  isWorkingState(): boolean {
    return this.isWorking;
  }

  setPathfindingSystem(system: PathfindingSystem): void {
    this.pathfindingSystem = system;
  }

moveTo(targetX: number, targetY: number, onArrival?: () => void): void {
    if (!this.pathfindingSystem) return;

    if (!this.originalPosition) {
      this.originalPosition = { x: this.x, y: this.y };
    }

    this.pathfindingSystem.findPath(this.x, this.y, targetX, targetY);
    this.currentPath = this.pathfindingSystem.getCurrentPath();
    this.pathfindingSystem.resetPath();
    this.targetPosition = { x: targetX, y: targetY };
    this.isNavigating = true;
    this.navigationState = 'moving';

    if (onArrival) {
      this.arrivalCallback = onArrival;
    }
  }

  updateNavigation(): void {
    if (!this.isNavigating || this.currentPath.length === 0) return;

    const currentIndex = this.pathfindingSystem?.getCurrentPathIndex() || 0;
    const nextPoint = this.currentPath[currentIndex];
    
    if (!nextPoint) {
      this.isNavigating = false;
      this.navigationState = 'arrived';
      this.setVelocityX(0);
      this.arrivalCallback?.();
      this.onArrivalCallbacks.forEach(cb => cb());
      this.arrivalCallback = null;
      return;
    }

    const dx = nextPoint.x - this.x;
    const dy = nextPoint.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.arrivalThreshold) {
      if (nextPoint.action === 'jump' && this.getOnFloor()) {
        this.setVelocityY(PHYSICS_CONFIG.jumpForce);
        this.navigationState = 'jumping';
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= this.currentPath.length) {
        this.isNavigating = false;
        this.navigationState = 'arrived';
        this.setVelocityX(0);
        this.arrivalCallback?.();
        this.onArrivalCallbacks.forEach(cb => cb());
        this.arrivalCallback = null;
        return;
      }
      
      this.pathfindingSystem?.advancePath();
    }

    const direction = dx > 0 ? 1 : -1;
    this.setVelocityX(direction * PHYSICS_CONFIG.moveSpeed);

    if (nextPoint.action === 'jump' && this.getOnFloor() && distance < 64) {
      this.setVelocityY(PHYSICS_CONFIG.jumpForce);
      this.navigationState = 'jumping';
    }
  }

  isNavigatingToTarget(): boolean {
    return this.isNavigating;
  }

  returnToOriginal(): void {
    if (this.originalPosition) {
      this.moveTo(this.originalPosition.x, this.originalPosition.y);
    }
  }

  getTargetPosition(): { x: number; y: number } | null {
    return this.targetPosition;
  }

  getNavigationState(): NavigationState {
    return this.navigationState;
  }

  getCurrentPath(): PathPoint[] {
    return this.currentPath;
  }

  setArrivalCallback(callback: () => void): void {
    this.onArrivalCallbacks.push(callback);
  }

  clearArrivalCallbacks(): void {
    this.onArrivalCallbacks = [];
  }
}

export function createAgent(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number
): AgentCharacter {
  const graphics = scene.add.graphics();
  graphics.fillStyle(color, 1);
  graphics.fillRect(-16, -32, 32, 32);
  graphics.generateTexture('agent_' + color, 32, 32);
  graphics.destroy();

  return new AgentCharacter(scene, x, y, 'agent_' + color, undefined, color);
}
