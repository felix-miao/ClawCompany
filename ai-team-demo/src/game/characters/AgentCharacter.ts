import Phaser from 'phaser';
import { PHYSICS_CONFIG } from '../config/gameConfig';
import { AnimationController, AnimationState } from '../systems/AnimationController';
import { PathfindingSystem, PathPoint } from '../systems/PathfindingSystem';

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

  moveTo(targetX: number, targetY: number): void {
    if (!this.pathfindingSystem) return;

    if (!this.originalPosition) {
      this.originalPosition = { x: this.x, y: this.y };
    }

    this.pathfindingSystem.findPath(this.x, this.y, targetX, targetY);
    this.targetPosition = { x: targetX, y: targetY };
    this.isNavigating = true;
  }

  updateNavigation(): void {
    if (!this.isNavigating || !this.pathfindingSystem) return;

    const nextPoint = this.pathfindingSystem.getNextPoint();
    if (!nextPoint) {
      this.isNavigating = false;
      this.setVelocityX(0);
      return;
    }

    const dx = nextPoint.x - this.x;
    const distance = Math.abs(dx);

    if (distance < this.arrivalThreshold) {
      this.pathfindingSystem.advancePath();
      
      if (nextPoint.action === 'jump' && this.getOnFloor()) {
        this.setVelocityY(PHYSICS_CONFIG.jumpForce);
      }

      if (this.pathfindingSystem.isPathComplete()) {
        this.isNavigating = false;
        this.setVelocityX(0);
        return;
      }
    }

    const direction = dx > 0 ? 1 : -1;
    this.setVelocityX(direction * PHYSICS_CONFIG.moveSpeed);

    if (nextPoint.action === 'jump' && this.getOnFloor() && distance < 64) {
      this.setVelocityY(PHYSICS_CONFIG.jumpForce);
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
