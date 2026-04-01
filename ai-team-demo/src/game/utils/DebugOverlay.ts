import Phaser from 'phaser';
import { AgentCharacter } from '../characters/AgentCharacter';
import { PHYSICS_CONFIG } from '../config/gameConfig';

export class DebugOverlay {
  private scene: Phaser.Scene;
  private fpsText: Phaser.GameObjects.Text;
  private positionText: Phaser.GameObjects.Text;
  private velocityText: Phaser.GameObjects.Text;
  private debugEnabled: boolean = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.fpsText = scene.add.text(10, 10, 'FPS: 0', {
      font: '14px monospace',
      color: '#00ff00',
    });
    this.fpsText.setDepth(1000);
    this.fpsText.setScrollFactor(0);

    this.positionText = scene.add.text(10, 30, 'Pos: 0, 0', {
      font: '14px monospace',
      color: '#00ff00',
    });
    this.positionText.setDepth(1000);
    this.positionText.setScrollFactor(0);

    this.velocityText = scene.add.text(10, 50, 'Vel: 0, 0', {
      font: '14px monospace',
      color: '#00ff00',
    });
    this.velocityText.setDepth(1000);
    this.velocityText.setScrollFactor(0);

    scene.input.keyboard?.on('keydown-D', () => {
      this.toggleDebug();
    });
  }

  update(agents: AgentCharacter[]): void {
    if (!this.debugEnabled) return;

    const fps = Math.round(this.scene.game.loop.actualFps);
    this.fpsText.setText(`FPS: ${fps}`);

    if (agents.length > 0) {
      const agent = agents[0];
      const x = Math.round(agent.x);
      const y = Math.round(agent.y);
      this.positionText.setText(`Pos: ${x}, ${y}`);

      const body = agent.body as Phaser.Physics.Arcade.Body;
      const vx = Math.round(body.velocity.x);
      const vy = Math.round(body.velocity.y);
      this.velocityText.setText(`Vel: ${vx}, ${vy}`);
    }

    this.fpsText.setVisible(this.debugEnabled);
    this.positionText.setVisible(this.debugEnabled);
    this.velocityText.setVisible(this.debugEnabled);
  }

  toggleDebug(): void {
    this.debugEnabled = !this.debugEnabled;
    this.scene.physics.world.drawDebug = this.debugEnabled;
    this.fpsText.setVisible(this.debugEnabled);
    this.positionText.setVisible(this.debugEnabled);
    this.velocityText.setVisible(this.debugEnabled);
  }
}