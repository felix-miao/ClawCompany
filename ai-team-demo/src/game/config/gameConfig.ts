import Phaser from 'phaser';

export const gameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  scene: [],
};

export const PHYSICS_CONFIG = {
  gravity: 800,
  jumpForce: -400,
  moveSpeed: 200,
  maxVelocity: 300,
  drag: 500,
};

export const TILE_SIZE = 32;
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;