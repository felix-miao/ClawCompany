import * as Phaser from 'phaser';

export const gameConfig = {
  type: Phaser.AUTO,
  width: 1200,
  height: 700,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [],
};

export const PHYSICS_CONFIG = {
  gravity: 0,
  jumpForce: 0,
  moveSpeed: 150,
  maxVelocity: 200,
  drag: 600,
};

export const TILE_SIZE = 32;
export const MAP_WIDTH = 38;
export const MAP_HEIGHT = 22;