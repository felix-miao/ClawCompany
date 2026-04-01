import Phaser from 'phaser';
import { PHYSICS_CONFIG } from '../config/gameConfig';

export class AgentCharacter extends Phaser.Physics.Arcade.Sprite {
  private isOnFloor: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    frame?: string | number
  ) {
    super(scene, x, y, texture, frame);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setBounce(0);
    this.setDrag(PHYSICS_CONFIG.drag, 0);
  }

  update(): void {
  }

  getOnFloor(): boolean {
    return this.body?.blocked.down || this.body?.touching.down || false;
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

  return new AgentCharacter(scene, x, y, 'agent_' + color);
}