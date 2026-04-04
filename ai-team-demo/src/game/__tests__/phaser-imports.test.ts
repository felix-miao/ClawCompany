import * as Phaser from 'phaser';

import { gameConfig, TILE_SIZE, PHYSICS_CONFIG } from '../config/gameConfig';
import { AgentCharacter, createAgent } from '../characters/AgentCharacter';
import { AnimationController, AnimationState } from '../systems/AnimationController';
import { MovementSystem } from '../systems/MovementSystem';
import { NavigationController } from '../systems/NavigationController';
import { PathfindingSystem } from '../systems/PathfindingSystem';
import { NavigationSystem } from '../systems/NavigationSystem';
import { DebugOverlay } from '../utils/DebugOverlay';
import { NavigationDebug } from '../utils/NavigationDebug';
import { OfficeDecorator } from '../ui/OfficeDecorator';
import { TargetMarker } from '../ui/TargetMarker';
import { CharacterSprites } from '../sprites/CharacterSprites';
import { Game, startGame } from '../index';

describe('Phaser Import Verification', () => {
  describe('default import', () => {
    it('should import Phaser as a default export', () => {
      expect(Phaser).toBeDefined();
    });

    it('should expose Phaser namespace with core modules', () => {
      expect(Phaser.Game).toBeDefined();
      expect(Phaser.Scene).toBeDefined();
      expect(Phaser.AUTO).toBeDefined();
      expect(Phaser.BlendModes).toBeDefined();
    });

    it('should expose Phaser.Types namespace', () => {
      expect(Phaser.Types).toBeDefined();
      expect(Phaser.Types.Core).toBeDefined();
      expect(Phaser.Types.Input).toBeDefined();
    });

    it('should expose Phaser.GameObjects namespace', () => {
      expect(Phaser.GameObjects).toBeDefined();
      expect(Phaser.GameObjects.Container).toBeDefined();
      expect(Phaser.GameObjects.Graphics).toBeDefined();
      expect(Phaser.GameObjects.Text).toBeDefined();
      expect(Phaser.GameObjects.Particles).toBeDefined();
    });

    it('should expose Phaser.Physics namespace', () => {
      expect(Phaser.Physics).toBeDefined();
      expect(Phaser.Physics.Arcade).toBeDefined();
    });

    it('should expose Phaser.Input namespace', () => {
      expect(Phaser.Input).toBeDefined();
      expect(Phaser.Input.Keyboard).toBeDefined();
      expect(Phaser.Input.Keyboard.KeyCodes).toBeDefined();
    });

    it('should expose Phaser.Tweens namespace', () => {
      expect(Phaser.Tweens).toBeDefined();
    });

    it('should expose Phaser.Time namespace', () => {
      expect(Phaser.Time).toBeDefined();
    });

    it('should expose Phaser.Cameras namespace', () => {
      expect(Phaser.Cameras).toBeDefined();
      expect(Phaser.Cameras.Scene2D).toBeDefined();
    });

    it('should expose Phaser.Math namespace', () => {
      expect(Phaser.Math).toBeDefined();
    });
  });

  describe('module re-export chain', () => {
    it('gameConfig should reference Phaser.AUTO', () => {
      expect(gameConfig.type).toBe(Phaser.AUTO);
    });

    it('AgentCharacter should extend Phaser.Physics.Arcade.Sprite', () => {
      expect(AgentCharacter.prototype).toBeInstanceOf(Phaser.Physics.Arcade.Sprite);
    });

    it('TargetMarker should extend Phaser.GameObjects.Container', () => {
      expect(TargetMarker.prototype).toBeInstanceOf(Phaser.GameObjects.Container);
    });

    it('Game should extend Phaser.Game', () => {
      expect(Game.prototype).toBeInstanceOf(Phaser.Game);
    });
  });

  describe('type-level imports', () => {
    it('Phaser.Types.Core.GameConfig should be accessible', () => {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
      };
      expect(config.type).toBe(Phaser.AUTO);
      expect(config.width).toBe(800);
      expect(config.height).toBe(600);
    });

    it('Phaser.Input.Keyboard.KeyCodes should have standard key mappings', () => {
      expect(Phaser.Input.Keyboard.KeyCodes.W).toBeDefined();
      expect(Phaser.Input.Keyboard.KeyCodes.A).toBeDefined();
      expect(Phaser.Input.Keyboard.KeyCodes.S).toBeDefined();
      expect(Phaser.Input.Keyboard.KeyCodes.D).toBeDefined();
    });
  });

  describe('all game modules resolve Phaser import', () => {
    const modulesThatImportPhaser = [
      { name: 'gameConfig', ref: gameConfig },
      { name: 'AgentCharacter', ref: AgentCharacter },
      { name: 'AnimationController', ref: AnimationController },
      { name: 'MovementSystem', ref: MovementSystem },
      { name: 'NavigationController', ref: NavigationController },
      { name: 'PathfindingSystem', ref: PathfindingSystem },
      { name: 'NavigationSystem', ref: NavigationSystem },
      { name: 'DebugOverlay', ref: DebugOverlay },
      { name: 'NavigationDebug', ref: NavigationDebug },
      { name: 'OfficeDecorator', ref: OfficeDecorator },
      { name: 'TargetMarker', ref: TargetMarker },
      { name: 'CharacterSprites', ref: CharacterSprites },
      { name: 'Game', ref: Game },
    ];

    it.each(modulesThatImportPhaser)('$name should be importable without errors', ({ ref }) => {
      expect(ref).toBeDefined();
    });
  });

  describe('constants derived from Phaser module', () => {
    it('TILE_SIZE should be a positive number', () => {
      expect(TILE_SIZE).toBeGreaterThan(0);
    });

    it('PHYSICS_CONFIG should have required physics values', () => {
      expect(PHYSICS_CONFIG.gravity).toBeDefined();
      expect(PHYSICS_CONFIG.jumpForce).toBeDefined();
      expect(PHYSICS_CONFIG.moveSpeed).toBeDefined();
      expect(PHYSICS_CONFIG.maxVelocity).toBeDefined();
      expect(PHYSICS_CONFIG.drag).toBeDefined();
    });
  });
});
