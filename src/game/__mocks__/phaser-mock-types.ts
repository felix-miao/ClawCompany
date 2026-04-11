/**
 * Phaser 类型定义 - 用于测试 Mock
 * 这些接口为 Phaser 类型和模拟提供类型安全
 */

// 使用更具体的类型而不是 any
type UnknownType = unknown;

export interface MockPhaserScene {
  constructor: (config: UnknownType) => void;
}

export interface MockPhaserSprite {
  constructor: (scene: UnknownType, x: number, y: number, texture: string) => void;
  setBounce: (x: number, y: number) => any;
  setCollideWorldBounds: (value: boolean) => any;
  setDepth: (value: number) => any;
  setSize: (width: number, height: number) => any;
  setOffset: (x: number, y: number) => any;
  body: MockPhaserBody;
}
class MockPhaserSpriteClass {
  constructor(_scene: UnknownType, _x: number, _y: number, _texture: string) {}
  setBounce(_x: number, _y: number): MockPhaserSprite { return this as unknown as MockPhaserSprite; }
  setCollideWorldBounds(_value: boolean): MockPhaserSprite { return this as unknown as MockPhaserSprite; }
  setDepth(_value: number): MockPhaserSprite { return this as unknown as MockPhaserSprite; }
  setSize(_width: number, _height: number): MockPhaserSprite { return this as unknown as MockPhaserSprite; }
  setOffset(_x: number, _y: number): MockPhaserSprite { return this as unknown as MockPhaserSprite; }
  body: MockPhaserBody = {} as MockPhaserBody;
}

export interface MockPhaserBody {
  setVelocityX: (x: number) => void;
  setVelocityY: (y: number) => void;
  setBounce: (x: number, y: number) => void;
  setCollideWorldBounds: (value: boolean) => void;
  onFloor: () => boolean;
}

export interface MockPhaserContainer {
  constructor: (scene: UnknownType, x: number, y: number, children: UnknownType[]) => void;
  add: (child: UnknownType) => any;
  remove: (child: UnknownType, destroy?: boolean) => any;
  setVisible: (value: boolean) => any;
  setAlpha: (value: number) => any;
  destroy: () => void;
}
class MockPhaserContainerClass {
  constructor(_scene: UnknownType, _x: number, _y: number, _children: UnknownType[]) {}
  add(_child: UnknownType): MockPhaserContainer { return this as unknown as MockPhaserContainer; }
  remove(_child: UnknownType, _destroy?: boolean): MockPhaserContainer { return this as unknown as MockPhaserContainer; }
  setVisible(_value: boolean): MockPhaserContainer { return this as unknown as MockPhaserContainer; }
  setAlpha(_value: number): MockPhaserContainer { return this as unknown as MockPhaserContainer; }
  destroy(): void {}
}

export interface MockPhaserGraphics {
  constructor: (scene: UnknownType) => void;
  fillStyle: (color: number, alpha?: number) => any;
  fillCircle: (x: number, y: number, radius: number) => any;
  lineStyle: (width: number, color: number, alpha?: number) => any;
  strokeCircle: (x: number, y: number, radius: number) => any;
  clear: () => any;
  destroy: () => void;
}
class MockPhaserGraphicsClass {
  constructor(_scene: UnknownType) {}
  fillStyle(_color: number, _alpha?: number): MockPhaserGraphics { return this as unknown as MockPhaserGraphics; }
  fillCircle(_x: number, _y: number, _radius: number): MockPhaserGraphics { return this as unknown as MockPhaserGraphics; }
  lineStyle(_width: number, _color: number, _alpha?: number): MockPhaserGraphics { return this as unknown as MockPhaserGraphics; }
  strokeCircle(_x: number, _y: number, _radius: number): MockPhaserGraphics { return this as unknown as MockPhaserGraphics; }
  clear(): MockPhaserGraphics { return this as unknown as MockPhaserGraphics; }
  destroy(): void {}
}

export interface MockPhaserText {
  constructor: (scene: UnknownType, x: number, y: number, text: string, style: UnknownType) => void;
  setText: (text: string) => any;
  setOrigin: (x: number, y?: number) => any;
  destroy: () => void;
}
class MockPhaserTextClass {
  constructor(_scene: UnknownType, _x: number, _y: number, _text: string, _style: UnknownType) {}
  setText(_text: string): MockPhaserText { return this as unknown as MockPhaserText; }
  setOrigin(_x: number, _y?: number): MockPhaserText { return this as unknown as MockPhaserText; }
  destroy(): void {}
}

export interface MockPhaserGame {
  type: UnknownType;
  parent: UnknownType;
  scene: UnknownType[];
  config: UnknownType;
  constructor: (config: UnknownType) => void;
}

export interface MockPhaser {
  __esModule: boolean;
  default: {
    Game: MockPhaserGame;
    Scene: MockPhaserScene;
    AUTO: number;
  };
  Game: MockPhaserGame;
  Scene: MockPhaserScene;
  Physics: {
    Arcade: {
      Sprite: any;
    };
  };
  GameObjects: {
    Container: any;
    Graphics: any;
    Text: any;
    Sprite: any;
  };
  AUTO: number;
}

// 游戏配置接口
export interface GameConfig {
  type: number;
  width: number;
  height: number;
  parent: string;
  scene?: UnknownType[];
}

// 测试工具类型
export interface TestGameConfig extends GameConfig {
  type: number; // Phaser.AUTO 是一个数字
}

// 用于 jest.mock 的工厂函数类型
export interface PhaserMockFactory {
  (module: string): MockPhaser;
}