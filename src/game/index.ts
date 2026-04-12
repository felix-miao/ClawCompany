import * as Phaser from 'phaser';

import { gameConfig } from './config/gameConfig';
import { OfficeScene } from './scenes/OfficeScene';
import { PerformanceMonitor } from './systems/PerformanceMonitor';
import { AgentCharacter } from './characters/AgentCharacter';

export class Game extends Phaser.Game {
  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
  }

  getPerformanceMonitor(): PerformanceMonitor | null {
    const scene = this.scene.getScene('OfficeScene');
    return (scene as { performanceMonitor?: PerformanceMonitor })?.performanceMonitor || null;
  }

  getAgents(): AgentCharacter[] {
    const scene = this.scene.getScene('OfficeScene');
    return (scene as { getAgents?: () => AgentCharacter[] })?.getAgents?.() || [];
  }

  triggerTestTask(description?: string): { agentId: string; description: string } | null {
    const scene = this.scene.getScene('OfficeScene');
    return (scene as { triggerTestTask?: (description?: string) => { agentId: string; description: string } | null })?.triggerTestTask?.(description) ?? null;
  }

  destroy(destroyChildren?: boolean): void {
    const scene = this.scene.getScene('OfficeScene');
    (scene as { shutdown?: () => void })?.shutdown?.();
    super.destroy(destroyChildren || false);
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
