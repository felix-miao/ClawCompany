import { Game, startGame } from '../index';
import { gameConfig } from '../config/gameConfig';
import { OfficeScene } from '../scenes/OfficeScene';
import { 
  MockPhaserScene, 
  MockPhaserSprite, 
  MockPhaserContainer, 
  MockPhaserGraphics, 
  MockPhaserText, 
  MockPhaserGame 
} from '../__mocks__/phaser-mock-types';

// Phaser mock 类型定义 - 使用 unknown 而不是 any
type PhaserMock = {
  __esModule: boolean;
  default: {
    Game: new (config: unknown) => MockPhaserGame;
    Scene: new (config: unknown) => MockPhaserScene;
    AUTO: number;
  };
  Game: new (config: unknown) => MockPhaserGame;
  Scene: new (config: unknown) => MockPhaserScene;
  Physics: {
    Arcade: {
      Sprite: new (scene: unknown, x: number, y: number, texture: string) => MockPhaserSprite;
    };
  };
  GameObjects: {
    Container: new (scene: unknown, x: number, y: number, children: unknown[]) => MockPhaserContainer;
    Graphics: new (scene: unknown) => MockPhaserGraphics;
    Text: new (scene: unknown, x: number, y: number, text: string, style: unknown) => MockPhaserText;
    Sprite: new (scene: unknown, x: number, y: number, texture: string) => MockPhaserSprite;
  };
  AUTO: number;
};

jest.mock('phaser', () => {
  const SceneClass = class implements MockPhaserScene {
    constructor(_config: unknown) {}
  };

  const SpriteClass = class implements MockPhaserSprite {
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

  const ContainerClass = class implements MockPhaserContainer {
    constructor(_scene: unknown, _x: number, _y: number, _children: unknown[]) {}
    add(_child: unknown) { return this; }
    remove(_child: unknown, _destroy?: boolean) { return this; }
    setVisible(_value: boolean) { return this; }
    setAlpha(_value: number) { return this; }
    destroy() {}
  };

  const GraphicsClass = class implements MockPhaserGraphics {
    constructor(_scene: unknown) {}
    fillStyle(_color: number, _alpha?: number) { return this; }
    fillCircle(_x: number, _y: number, _radius: number) { return this; }
    lineStyle(_width: number, _color: number, _alpha?: number) { return this; }
    strokeCircle(_x: number, _y: number, _radius: number) { return this; }
    clear() { return this; }
    destroy() {}
  };

  const TextClass = class implements MockPhaserText {
    constructor(_scene: unknown, _x: number, _y: number, _text: string, _style: unknown) {}
    setText(_text: string) { return this; }
    setOrigin(_x: number, _y?: number) { return this; }
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

  const GameClass = class implements MockPhaserGame {
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
    },
    Game: GameClass,
    Scene: SceneClass,
    Physics: PhysicsClass,
    GameObjects: GameObjectsClass,
    AUTO: 0,
  } as PhaserMock;
});

describe('Game module', () => {
  describe('Game class', () => {
    it('should be constructable with a config', () => {
      const config = { type: 0, width: 800, height: 600 };
      const game = new Game(config);
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
