import { Game, startGame } from '../index';
import { gameConfig } from '../config/gameConfig';
import { OfficeScene } from '../scenes/OfficeScene';

jest.mock('phaser', () => {
  const SceneClass = class {
    constructor(config: any) {}
  };

  const SpriteClass = class {
    constructor(scene: any, x: number, y: number, texture: string) {}
    setBounce(x: number, y: number) { return this; }
    setCollideWorldBounds(value: boolean) { return this; }
    setDepth(value: number) { return this; }
    setSize(width: number, height: number) { return this; }
    setOffset(x: number, y: number) { return this; }
    body: any = {
      setVelocityX: jest.fn(),
      setVelocityY: jest.fn(),
      setBounce: jest.fn(),
      setCollideWorldBounds: jest.fn(),
      onFloor: jest.fn(() => true),
    };
  };

  const ContainerClass = class {
    constructor(scene: any, x: number, y: number, children: any[]) {}
    add(child: any) { return this; }
    remove(child: any, destroy?: boolean) { return this; }
    setVisible(value: boolean) { return this; }
    setAlpha(value: number) { return this; }
    destroy() {}
  };

  const GraphicsClass = class {
    constructor(scene: any) {}
    fillStyle(color: number, alpha?: number) { return this; }
    fillCircle(x: number, y: number, radius: number) { return this; }
    lineStyle(width: number, color: number, alpha?: number) { return this; }
    strokeCircle(x: number, y: number, radius: number) { return this; }
    clear() { return this; }
    destroy() {}
  };

  const TextClass = class {
    constructor(scene: any, x: number, y: number, text: string, style: any) {}
    setText(text: string) { return this; }
    setOrigin(x: number, y?: number) { return this; }
    destroy() {}
  };

  const ArcadeClass = {
    Sprite: SpriteClass,
  };

  const PhysicsClass = {
    Arcade: ArcadeClass,
  };

  const GameObjectsClass = {
    Container: ContainerClass,
    Graphics: GraphicsClass,
    Text: TextClass,
    Sprite: SpriteClass,
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
    Game: GameClass,
    Scene: SceneClass,
    Physics: PhysicsClass,
    GameObjects: GameObjectsClass,
    AUTO: 0,
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
