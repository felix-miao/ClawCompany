import * as Phaser from 'phaser';

import { gameConfig } from './config/gameConfig';
import { OfficeScene } from './scenes/OfficeScene';
import { PerformanceMonitor } from './systems/PerformanceMonitor';
import { AgentCharacter } from './characters/AgentCharacter';
import type { GameEvent } from './types/GameEvents';

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

  receiveGameEvent(event: GameEvent): void {
    const scene = this.scene.getScene('OfficeScene');
    (scene as { receiveGameEvent?: (event: GameEvent) => void })?.receiveGameEvent?.(event);
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
  const game = new Game(config);

  // Pause the Phaser loop when the browser tab is hidden, resume when visible again
  if (typeof document !== 'undefined') {
    const onVisibilityChange = () => {
      if (document.hidden) {
        game.loop.sleep();
      } else {
        game.loop.wake();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Clean up the listener when the game is destroyed
    const originalDestroy = game.destroy.bind(game);
    game.destroy = (destroyChildren?: boolean) => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      originalDestroy(destroyChildren);
    };
  }

  return game;
}
