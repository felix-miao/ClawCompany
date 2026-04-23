import { AgentCharacter } from '../AgentCharacter';

jest.mock('phaser', () => {
  class Sprite {
    scene: any;
    x: number;
    y: number;
    depth: number = 0;
    body: any = { blocked: { down: false }, touching: { down: false } };
    flipX: boolean = false;
    constructor(scene: any, x: number, y: number) {
      this.scene = scene;
      this.x = x;
      this.y = y;
    }
    setCollideWorldBounds = jest.fn().mockReturnThis();
    setBounce = jest.fn().mockReturnThis();
    setDrag = jest.fn().mockReturnThis();
    setVelocityX = jest.fn().mockReturnThis();
    setVelocityY = jest.fn().mockReturnThis();
    play = jest.fn().mockReturnThis();
    getOnFloor = jest.fn().mockReturnValue(false);
  }

  return {
    Scale: {
      FIT: 'FIT',
      CENTER_BOTH: 'CENTER_BOTH',
    },
    Physics: {
      Arcade: {
        Sprite,
      },
    },
    GameObjects: {
      Text: class Text {},
      Container: class Container {},
    },
  };
});

jest.mock('../../systems/AnimationController', () => ({
  AnimationController: jest.fn().mockImplementation(() => ({
    update: jest.fn(),
  })),
}));

jest.mock('../../systems/EmotionSystem', () => {
  class EmotionSystem {
    private emotion: string = 'idle';
    private needsRedraw: boolean = false;

    setEmotion(emotion: string): void {
      this.emotion = emotion;
      this.needsRedraw = true;
    }
    update(): { needsRedraw: boolean } {
      const needsRedraw = this.needsRedraw;
      this.needsRedraw = false;
      return { needsRedraw };
    }
    getBubbleConfig(_x: number, y: number) {
      if (this.emotion === 'idle') return null;
      return {
        y,
        width: 48,
        height: 32,
        emoji: '😊',
        bgColor: 0xffffff,
        animation: { bounceAmplitude: 0, bounceDuration: 0 },
      };
    }
    getEmotionFromTask() {
      return 'happy';
    }
  }

  return { EmotionSystem };
});

jest.mock('../../sprites/CharacterSprites', () => ({
  CharacterSprites: jest.fn().mockImplementation(() => ({ generate: jest.fn() })),
}));

function createMockContainer() {
  return {
    x: 0,
    y: 0,
    add: jest.fn(),
    setPosition: jest.fn(function (x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }),
    destroy: jest.fn(),
  };
}

function createMockScene() {
  const containers: ReturnType<typeof createMockContainer>[] = [];
  return {
    add: {
      existing: jest.fn(),
      graphics: jest.fn(() => ({
        fillStyle: jest.fn(),
        fillRoundedRect: jest.fn(),
        lineStyle: jest.fn(),
        strokeRoundedRect: jest.fn(),
        destroy: jest.fn(),
      })),
      text: jest.fn(() => ({
        setOrigin: jest.fn(),
        setDepth: jest.fn(),
      })),
      container: jest.fn((x: number, y: number) => {
        const container = createMockContainer();
        container.setPosition(x, y);
        containers.push(container);
        return container;
      }),
    },
    physics: {
      add: {
        existing: jest.fn(),
      },
    },
    tweens: {
      add: jest.fn(() => ({ isActive: () => false, stop: jest.fn(), destroy: jest.fn() })),
      killTweensOf: jest.fn(),
    },
    game: {
      loop: { delta: 16 },
    },
  } as unknown as Phaser.Scene;
}

describe('AgentCharacter behavior', () => {
  it('keeps the emotion bubble aligned with the agent position', () => {
    const scene = createMockScene();
    const agent = new AgentCharacter(scene as Phaser.Scene, 100, 200, 'idle_1');

    agent.setEmotion('happy');
    agent.update();

    const bubble = scene.add.container.mock.results[0].value;
    expect(bubble.setPosition).toHaveBeenLastCalledWith(100, 160);

    agent.x = 180;
    agent.y = 260;
    agent.update();

    expect(bubble.setPosition).toHaveBeenLastCalledWith(180, 220);
  });
});
