import Phaser from 'phaser';
import { AgentCharacter } from '../characters/AgentCharacter';

export interface NavigationDebugConfig {
  showTargetPosition: boolean;
  showPath: boolean;
  showState: boolean;
  showVelocity: boolean;
}

const DEFAULT_CONFIG: NavigationDebugConfig = {
  showTargetPosition: true,
  showPath: true,
  showState: true,
  showVelocity: false,
};

export class NavigationDebug {
  private scene: Phaser.Scene;
  private agents: AgentCharacter[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private textObjects: Phaser.GameObjects.Text[] = [];
  private config: NavigationDebugConfig;
  private visible: boolean = true;

  constructor(scene: Phaser.Scene, config: Partial<NavigationDebugConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.graphics = scene.add.graphics();
  }

  setAgents(agents: AgentCharacter[]): void {
    this.agents = agents;
  }

  update(): void {
    if (!this.visible) {
      this.graphics.setVisible(false);
      this.textObjects.forEach(t => t.setVisible(false));
      return;
    }

    this.graphics.setVisible(true);
    this.textObjects.forEach(t => t.setVisible(true));

    this.graphics.clear();

    this.agents.forEach((agent, index) => {
      this.drawAgentDebug(agent, index);
    });
  }

  private drawAgentDebug(agent: AgentCharacter, index: number): void {
    if (this.config.showTargetPosition) {
      const target = agent.getTargetPosition();
      if (target) {
        this.graphics.fillStyle(0xffff00, 0.6);
        this.graphics.fillCircle(target.x, target.y, 8);
        this.graphics.lineStyle(2, 0xffff00, 1);
        this.graphics.strokeCircle(target.x, target.y, 12);
      }
    }

    if (this.config.showPath) {
      const path = agent.getCurrentPath();
      if (path && path.length > 0) {
        this.graphics.lineStyle(2, 0x00ff00, 0.5);
        
        this.graphics.beginPath();
        this.graphics.moveTo(agent.x, agent.y);
        
        path.forEach(point => {
          this.graphics.lineTo(point.x, point.y);
        });
        
        this.graphics.strokePath();

        path.forEach(point => {
          const color = point.action === 'jump' ? 0xff0000 : 0x00ff00;
          this.graphics.fillStyle(color, 0.8);
          this.graphics.fillCircle(point.x, point.y, 4);
        });
      }
    }

    if (this.config.showState) {
      const state = agent.getNavigationState();
      const isNavigating = agent.isNavigatingToTarget();
      
      this.ensureTextObject(index);
      const text = this.textObjects[index];
      
      const stateText = isNavigating ? `NAV: ${state}` : 'IDLE';
      text.setText(stateText);
      text.setPosition(agent.x - 30, agent.y - 50);
    }

    if (this.config.showVelocity) {
      const body = agent.body;
      if (body) {
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        
        this.graphics.lineStyle(2, 0x00ffff, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(agent.x, agent.y);
        this.graphics.lineTo(agent.x + vx * 0.1, agent.y + vy * 0.1);
        this.graphics.strokePath();
      }
    }
  }

  private ensureTextObject(index: number): void {
    if (!this.textObjects[index]) {
      const text = this.scene.add.text(0, 0, '', {
        font: '12px monospace',
        color: '#ffffff',
        backgroundColor: '#000000aa',
      });
      this.textObjects[index] = text;
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.graphics.setVisible(visible);
    this.textObjects.forEach(t => t.setVisible(visible));
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  updateConfig(config: Partial<NavigationDebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  destroy(): void {
    this.graphics.destroy();
    this.textObjects.forEach(t => t.destroy());
  }
}