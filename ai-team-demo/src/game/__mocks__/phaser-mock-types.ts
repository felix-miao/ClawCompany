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
  setBounce: (x: number, y: number) => MockPhaserSprite;
  setCollideWorldBounds: (value: boolean) => MockPhaserSprite;
  setDepth: (value: number) => MockPhaserSprite;
  setSize: (width: number, height: number) => MockPhaserSprite;
  setOffset: (x: number, y: number) => MockPhaserSprite;
  body: MockPhaserBody;
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
  add: (child: UnknownType) => MockPhaserContainer;
  remove: (child: UnknownType, destroy?: boolean) => MockPhaserContainer;
  setVisible: (value: boolean) => MockPhaserContainer;
  setAlpha: (value: number) => MockPhaserContainer;
  destroy: () => void;
}

export interface MockPhaserGraphics {
  constructor: (scene: UnknownType) => void;
  fillStyle: (color: number, alpha?: number) => MockPhaserGraphics;
  fillCircle: (x: number, y: number, radius: number) => MockPhaserGraphics;
  lineStyle: (width: number, color: number, alpha?: number) => MockPhaserGraphics;
  strokeCircle: (x: number, y: number, radius: number) => MockPhaserGraphics;
  clear: () => MockPhaserGraphics;
  destroy: () => void;
}

export interface MockPhaserText {
  constructor: (scene: UnknownType, x: number, y: number, text: string, style: UnknownType) => void;
  setText: (text: string) => MockPhaserText;
  setOrigin: (x: number, y?: number) => MockPhaserText;
  destroy: () => void;
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
      Sprite: typeof MockPhaserSprite;
    };
  };
  GameObjects: {
    Container: typeof MockPhaserContainer;
    Graphics: typeof MockPhaserGraphics;
    Text: typeof MockPhaserText;
    Sprite: typeof MockPhaserSprite;
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