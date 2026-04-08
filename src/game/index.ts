import * as Phaser from 'phaser';

import { gameConfig } from './config/gameConfig';
import { OfficeScene } from './scenes/OfficeScene';
import { PerformanceMonitor } from './systems/PerformanceMonitor';

export class Game extends Phaser.Game {
  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
  }

  getPerformanceMonitor(): PerformanceMonitor | null {
    const scene = this.scene.getScene('OfficeScene');
    return (scene as { performanceMonitor?: PerformanceMonitor })?.performanceMonitor || null;
  }

  getAgents(): any[] {
    const scene = this.scene.getScene('OfficeScene');
    return (scene as { getAgents?: () => any[] })?.getAgents?.() || [];
  }

  destroy(destroyChildren?: boolean): void {
    super.destroy(destroyChildren || false);
    const scene = this.scene.getScene('OfficeScene');
    (scene as any)?.shutdown();
  }
}

export function startGame(containerId: string): Game {
  const config: Phaser.Types.Core.GameConfig = {
    ...gameConfig,
    parent: containerId,
    scene: [OfficeScene],
  };
  return new Game(config);
}