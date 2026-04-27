/**
 * Phaser 类型定义 - 用于测试 Mock
 * 这些接口为 Phaser 类型和模拟提供类型安全
 */

// 使用更具体的类型而不是 any
type UnknownType = unknown;

interface MockPhaserSpriteInstance {
  setBounce: (x: number, y: number) => MockPhaserSpriteInstance;
  setCollideWorldBounds: (value: boolean) => MockPhaserSpriteInstance;
  setDepth: (value: number) => MockPhaserSpriteInstance;
  setSize: (width: number, height: number) => MockPhaserSpriteInstance;
  setOffset: (x: number, y: number) => MockPhaserSpriteInstance;
  body: MockPhaserBody;
}

interface MockPhaserContainerInstance {
  add: (child: UnknownType) => MockPhaserContainerInstance;
  remove: (child: UnknownType, destroy?: boolean) => MockPhaserContainerInstance;
  setVisible: (value: boolean) => MockPhaserContainerInstance;
  setAlpha: (value: number) => MockPhaserContainerInstance;
  destroy: () => void;
}

interface MockPhaserGraphicsInstance {
  fillStyle: (color: number, alpha?: number) => MockPhaserGraphicsInstance;
  fillCircle: (x: number, y: number, radius: number) => MockPhaserGraphicsInstance;
  lineStyle: (width: number, color: number, alpha?: number) => MockPhaserGraphicsInstance;
  strokeCircle: (x: number, y: number, radius: number) => MockPhaserGraphicsInstance;
  clear: () => MockPhaserGraphicsInstance;
  destroy: () => void;
}

interface MockPhaserTextInstance {
  setText: (text: string) => MockPhaserTextInstance;
  setOrigin: (x: number, y?: number) => MockPhaserTextInstance;
  destroy: () => void;
}

export interface MockPhaserScene {
  constructor: (config: UnknownType) => void;
}

export interface MockPhaserSprite {
  constructor: new (scene: UnknownType, x: number, y: number, texture: string) => MockPhaserSpriteInstance;
}

export interface MockPhaserBody {
  setVelocityX: (x: number) => void;
  setVelocityY: (y: number) => void;
  setBounce: (x: number, y: number) => void;
  setCollideWorldBounds: (value: boolean) => void;
  onFloor: () => boolean;
}

export interface MockPhaserContainer {
  constructor: new (scene: UnknownType, x: number, y: number, children: UnknownType[]) => MockPhaserContainerInstance;
}

export interface MockPhaserGraphics {
  constructor: new (scene: UnknownType) => MockPhaserGraphicsInstance;
}

export interface MockPhaserText {
  constructor: new (scene: UnknownType, x: number, y: number, text: string, style: UnknownType) => MockPhaserTextInstance;
}

export interface MockPhaserGame {
  type: UnknownType;
  parent: UnknownType;
  scene: UnknownType[];
  config: UnknownType;
}

export interface MockPhaserSceneConstructor {
  new (config: UnknownType): MockPhaserScene;
}

export interface MockPhaserSpriteConstructor {
  new (scene: UnknownType, x: number, y: number, texture: string): MockPhaserSprite;
}

export interface MockPhaserContainerConstructor {
  new (scene: UnknownType, x: number, y: number, children: UnknownType[]): MockPhaserContainer;
}

export interface MockPhaserGraphicsConstructor {
  new (scene: UnknownType): MockPhaserGraphics;
}

export interface MockPhaserTextConstructor {
  new (scene: UnknownType, x: number, y: number, text: string, style: UnknownType): MockPhaserText;
}

export interface MockPhaserGameConstructor {
  new (config: UnknownType): MockPhaserGame;
}

export interface MockPhaser {
  __esModule: boolean;
  default: {
    Game: MockPhaserGameConstructor;
    Scene: MockPhaserSceneConstructor;
    AUTO: number;
  };
  Game: MockPhaserGameConstructor;
  Scene: MockPhaserSceneConstructor;
  Physics: {
    Arcade: {
      Sprite: MockPhaserSpriteConstructor;
    };
  };
  GameObjects: {
    Container: MockPhaserContainerConstructor;
    Graphics: MockPhaserGraphicsConstructor;
    Text: MockPhaserTextConstructor;
    Sprite: MockPhaserSpriteConstructor;
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
