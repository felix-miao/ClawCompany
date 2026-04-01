import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';
import { OfficeScene } from './scenes/OfficeScene';

export class Game extends Phaser.Game {
  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
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