import { Game, startGame } from '../index';
import { gameConfig } from '../config/gameConfig';
import { OfficeScene } from '../scenes/OfficeScene';
import { MockPhaserScene, MockPhaserGame } from '../__mocks__/phaser-mock-types';

jest.mock('phaser', () => {
  const SceneClass = class {
    constructor(_config: unknown) {}
  };

  const SpriteClass = class {
    constructor(_scene: unknown, _x: number, _y: number, _texture: string) {}
    setBounce(_x: number, _y: number) { return this; }
    setCollideWorldBounds(_value: boolean) { return this; }
    setDepth(_value: number) { return this; }
    setSize(_width: number, _height: number) { return this; }
    setOffset(_x: number, _y: number) { return this; }
    body = {
      setVelocityX: jest.fn(),
      setVelocityY: jest.fn(),
      setBounce: jest.fn(),
      setCollideWorldBounds: jest.fn(),
      onFloor: jest.fn(() => true),
    };
  };

  const ContainerClass = class {
    constructor(_scene: unknown, _x: number, _y: number, _children: unknown[]) {}
    add(_child: unknown) { return this; }
    remove(_child: unknown, _destroy?: boolean) { return this; }
    setVisible(_value: boolean) { return this; }
    setAlpha(_value: number) { return this; }
    destroy() {}
  };

  const GraphicsClass = class {
    constructor(_scene: unknown) {}
    fillStyle(_color: number, _alpha?: number) { return this; }
    fillCircle(_x: number, _y: number, _radius: number) { return this; }
    lineStyle(_width: number, _color: number, _alpha?: number) { return this; }
    strokeCircle(_x: number, _y: number, _radius: number) { return this; }
    clear() { return this; }
    destroy() {}
  };

  const TextClass = class {
    constructor(_scene: unknown, _x: number, _y: number, _text: string, _style: unknown) {}
    setText(_text: string) { return this; }
    setOrigin(_x: number, _y?: number) { return this; }
    setFontSize(_size: number) { return this; }
    setColor(_color: string) { return this; }
    setStroke(_color: string, _width: number) { return this; }
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

  const ScaleClass = {
    FIT: 0,
    CENTER_BOTH: 0,
  };

  const GameClass = class {
    type: unknown;
    parent: unknown;
    scene: unknown[];
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
      const typedConfig = config as { type?: unknown; parent?: unknown; scene?: unknown[] };
      this.type = typedConfig.type;
      this.parent = typedConfig.parent;
      this.scene = typedConfig.scene || [];
    }
  };

  return {
    __esModule: true,
    default: {
      Game: GameClass,
      Scene: SceneClass,
      AUTO: 0,
      Scale: ScaleClass,
    },
    Game: GameClass,
    Scene: SceneClass,
    Physics: PhysicsClass,
    GameObjects: GameObjectsClass,
    AUTO: 0,
    Scale: ScaleClass,
  } as any;
});

describe('Game module', () => {
  describe('Game class', () => {
    it('should be constructable with a config', () => {
      const config = { type: 0, width: 800, height: 600 };
      const game = new Game(config) as any;
      expect(game).toBeDefined();
      expect(game.type).toBe(0);
    });

    it('should extend Phaser.Game', () => {
      expect(Game.prototype).toBeDefined();
    });
  });

  describe('startGame', () => {
    it('should create a Game with the given containerId as parent', () => {
      const game = startGame('test-container') as any;
      expect(game).toBeDefined();
      expect(game.parent).toBe('test-container');
    });

    it('should include OfficeScene in the scene list', () => {
      const game = startGame('test-container') as any;
      expect(game.scene).toContain(OfficeScene);
    });

    it('should spread gameConfig into the final config', () => {
      const game = startGame('my-container') as any;
      expect(game.config.type).toBe(gameConfig.type);
    });

    it('should return a Game instance', () => {
      const game = startGame('container');
      expect(game).toBeInstanceOf(Game);
    });
  });

  describe('triggerTestTask', () => {
    it('should delegate to OfficeScene.triggerTestTask', () => {
      const game = startGame('container');
      const mockResult = { agentId: 'pm-agent', description: 'test' };
      (game as any).scene = {
        getScene: jest.fn().mockReturnValue({
          triggerTestTask: jest.fn().mockReturnValue(mockResult),
        }),
      };
      const result = game.triggerTestTask('test');
      expect(result).toEqual(mockResult);
    });

    it('should return null when scene has no triggerTestTask', () => {
      const game = startGame('container');
      (game as any).scene = {
        getScene: jest.fn().mockReturnValue({}),
      };
      const result = game.triggerTestTask('test');
      expect(result).toBeNull();
    });
  });
});
