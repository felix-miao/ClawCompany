// Shared Phaser mock for all game tests

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
  Particles: {
    ParticleEmitter: class {
      constructor(scene: any, x: number, y: number, texture: string) {}
      setSpeed(speed: number) { return this; }
      setScale(scale: number) { return this; }
      start() { return this; }
      stop() { return this; }
    },
  },
  Rectangle: class {
    constructor(scene: any, x: number, y: number, width: number, height: number) {}
    setFillStyle(color: number, alpha?: number) { return this; }
    setStrokeStyle(width: number, color: number, alpha?: number) { return this; }
  },
  Ellipse: class {
    constructor(scene: any, x: number, y: number, width: number, height: number) {}
    setFillStyle(color: number, alpha?: number) { return this; }
    setStrokeStyle(width: number, color: number, alpha?: number) { return this; }
  },
  Zone: class {
    constructor(scene: any, x: number, y: number, width: number, height: number) {}
    setRectangleDropZone(width: number, height: number) { return this; }
  },
};

const MathClass = {
  Between: jest.fn((min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min)),
  FloatBetween: jest.fn((min: number, max: number) => Math.random() * (max - min) + min),
  Clamp: jest.fn((value: number, min: number, max: number) => Math.max(min, Math.min(max, value))),
  Distance: {
    Between: jest.fn((x1: number, y1: number, x2: number, y2: number) => 
      Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
    ),
  },
};

const KeyCodesClass = {
  W: 87,
  A: 65,
  S: 83,
  D: 68,
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  SPACE: 32,
  ENTER: 13,
  ESC: 27,
};

const KeyboardClass = {
  KeyCodes: KeyCodesClass,
};

const InputClass = {
  Keyboard: KeyboardClass,
};

const TimeClass = {
  Clock: class {
    constructor(scene: any) {}
    now: number = Date.now();
  },
  Timeline: class {
    constructor(scene: any) {}
  },
};

const CamerasClass = {
  Scene2D: class {
    constructor(scene: any) {}
    setZoom(value: number) { return this; }
    setScroll(x: number, y: number) { return this; }
    setBackgroundColor(color: number) { return this; }
  },
};

const TypesClass = {
  Core: {},
  Input: {},
  GameObjects: {},
  Math: {},
};

const TweensClass = class {
  constructor(scene: any) {}
  add(config: any) { return this; }
  create(config: any) { return this; }
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

const BlendModesClass = {
  SKIP_CHECK: -1,
  NORMAL: 0,
  ADD: 1,
  MULTIPLY: 2,
  SCREEN: 3,
  OVERLAY: 4,
  DARKEN: 5,
  LIGHTEN: 6,
  COLOR_DODGE: 7,
  COLOR_BURN: 8,
  HARD_LIGHT: 9,
  SOFT_LIGHT: 10,
  DIFFERENCE: 11,
  EXCLUSION: 12,
  HUE: 13,
  SATURATION: 14,
  COLOR: 15,
  LUMINOSITY: 16,
};

const ScaleModesClass = {
  NONE: 0,
  SETWIDTH: 1,
  SETHEIGHT: 2,
  RESIZE: 3,
};

const AUTO = 0;

export {
  GameClass as Game,
  SceneClass as Scene,
  PhysicsClass as Physics,
  GameObjectsClass as GameObjects,
  MathClass as Math,
  InputClass as Input,
  TimeClass as Time,
  CamerasClass as Cameras,
  TypesClass as Types,
  TweensClass as Tweens,
  BlendModesClass as BlendModes,
  ScaleModesClass as ScaleModes,
  AUTO,
};

export default {
  Game: GameClass,
  Scene: SceneClass,
  Physics: PhysicsClass,
  GameObjects: GameObjectsClass,
  Math: MathClass,
  Input: InputClass,
  Time: TimeClass,
  Cameras: CamerasClass,
  Types: TypesClass,
  Tweens: TweensClass,
  BlendModes: BlendModesClass,
  ScaleModes: ScaleModesClass,
  AUTO: 0,
};
