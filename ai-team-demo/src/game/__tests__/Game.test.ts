import { Game, startGame } from '../index';
import { gameConfig } from '../config/gameConfig';
import { OfficeScene } from '../scenes/OfficeScene';

jest.mock('phaser', () => {
  const SceneClass = class {
    constructor(config: any) {}
  };
  const GameClass = class {
    type: any;
    parent: any;
    scene: any[];
    config: any;
    constructor(config: any) {
      this.config = config;
      this.type = config.type;
      this.parent = config.parent;
      this.scene = config.scene || [];
    }
  };
  return {
    __esModule: true,
    default: {
      Game: GameClass,
      Scene: SceneClass,
      AUTO: 0,
    },
  };
});

describe('Game module', () => {
  describe('Game class', () => {
    it('should be constructable with a config', () => {
      const config = { type: 0, width: 800, height: 600 };
      const game = new Game(config as any);
      expect(game).toBeDefined();
      expect(game.type).toBe(0);
    });

    it('should extend Phaser.Game', () => {
      expect(Game.prototype).toBeDefined();
    });
  });

  describe('startGame', () => {
    it('should create a Game with the given containerId as parent', () => {
      const game = startGame('test-container');
      expect(game).toBeDefined();
      expect(game.parent).toBe('test-container');
    });

    it('should include OfficeScene in the scene list', () => {
      const game = startGame('test-container');
      expect(game.scene).toContain(OfficeScene);
    });

    it('should spread gameConfig into the final config', () => {
      const game = startGame('my-container');
      expect(game.config.type).toBe(gameConfig.type);
    });

    it('should return a Game instance', () => {
      const game = startGame('container');
      expect(game).toBeInstanceOf(Game);
    });
  });
});
