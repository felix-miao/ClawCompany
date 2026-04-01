import Phaser from 'phaser';
import { PHYSICS_CONFIG } from '../config/gameConfig';
import { AgentCharacter } from '../characters/AgentCharacter';

export class MovementSystem {
  private scene: Phaser.Scene;
  private activeAgent: AgentCharacter | null = null;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: { up?: Phaser.Input.Keyboard.Key; down?: Phaser.Input.Keyboard.Key; left?: Phaser.Input.Keyboard.Key; right?: Phaser.Input.Keyboard.Key };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as { up?: Phaser.Input.Keyboard.Key; down?: Phaser.Input.Keyboard.Key; left?: Phaser.Input.Keyboard.Key; right?: Phaser.Input.Keyboard.Key };
  }

  setActiveAgent(agent: AgentCharacter): void {
    this.activeAgent = agent;
  }

  update(): void {
    if (!this.activeAgent) return;

    const body = this.activeAgent.body as Phaser.Physics.Arcade.Body;
    const leftPressed = this.cursors.left?.isDown || this.wasd.left?.isDown;
    const rightPressed = this.cursors.right?.isDown || this.wasd.right?.isDown;
    const jumpPressed = this.cursors.up?.isDown || this.wasd.up?.isDown;

    if (leftPressed) {
      if (body.velocity.x > -PHYSICS_CONFIG.maxVelocity) {
        body.setAccelerationX(-PHYSICS_CONFIG.moveSpeed * 2);
      }
      this.activeAgent.flipX = true;
    } else if (rightPressed) {
      if (body.velocity.x < PHYSICS_CONFIG.maxVelocity) {
        body.setAccelerationX(PHYSICS_CONFIG.moveSpeed * 2);
      }
      this.activeAgent.flipX = false;
    } else {
      body.setAccelerationX(0);
    }

    const canJump = body.blocked.down || body.touching.down;
    if (jumpPressed && canJump) {
      this.activeAgent.setVelocityY(PHYSICS_CONFIG.jumpForce);
    }
  }
}