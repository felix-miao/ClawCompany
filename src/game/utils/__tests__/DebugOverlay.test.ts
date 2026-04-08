import { DebugOverlay } from '../DebugOverlay';

function createMockText() {
  return {
    setText: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    setScrollFactor: jest.fn().mockReturnThis(),
    setVisible: jest.fn().mockReturnThis(),
  };
}

function createMockScene() {
  const texts: ReturnType<typeof createMockText>[] = [];
  const scene = {
    add: {
      text: jest.fn().mockImplementation(() => {
        const t = createMockText();
        texts.push(t);
        return t;
      }),
    },
    input: {
      keyboard: {
        on: jest.fn(),
      },
    },
    physics: {
      world: {
        drawDebug: false,
      },
    },
    game: {
      loop: {
        actualFps: 60,
      },
    },
  };
  return { scene, texts };
}

function createMockAgent(x: number, y: number, vx: number, vy: number) {
  return {
    x,
    y,
    body: {
      velocity: { x: vx, y: vy },
    },
  } as any;
}

describe('DebugOverlay', () => {
  let overlay: DebugOverlay;
  let mockScene: ReturnType<typeof createMockScene>['scene'];
  let texts: ReturnType<typeof createMockText>[];

  beforeEach(() => {
    const result = createMockScene();
    mockScene = result.scene;
    texts = result.texts;
    overlay = new DebugOverlay(mockScene as any);
  });

  describe('constructor', () => {
    it('should create three text objects', () => {
      expect(mockScene.add.text).toHaveBeenCalledTimes(3);
    });

    it('should create FPS text at position (10, 10)', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(10, 10, 'FPS: 0', expect.objectContaining({ color: '#00ff00' }));
    });

    it('should create position text at (10, 30)', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(10, 30, 'Pos: 0, 0', expect.objectContaining({ color: '#00ff00' }));
    });

    it('should create velocity text at (10, 50)', () => {
      expect(mockScene.add.text).toHaveBeenCalledWith(10, 50, 'Vel: 0, 0', expect.objectContaining({ color: '#00ff00' }));
    });

    it('should set depth 1000 on all text objects', () => {
      texts.forEach(t => {
        expect(t.setDepth).toHaveBeenCalledWith(1000);
      });
    });

    it('should set scroll factor 0 on all text objects', () => {
      texts.forEach(t => {
        expect(t.setScrollFactor).toHaveBeenCalledWith(0);
      });
    });

    it('should register D key handler', () => {
      expect(mockScene.input.keyboard!.on).toHaveBeenCalledWith('keydown-D', expect.any(Function));
    });

    it('should start with debug enabled', () => {
      const result = createMockScene();
      const o = new DebugOverlay(result.scene as any);
      o.update([]);
      expect(result.texts[0].setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('update', () => {
    it('should update FPS text with current FPS', () => {
      overlay.update([]);
      expect(texts[0].setText).toHaveBeenCalledWith('FPS: 60');
    });

    it('should round FPS value', () => {
      mockScene.game.loop.actualFps = 59.7;
      overlay.update([]);
      expect(texts[0].setText).toHaveBeenCalledWith('FPS: 60');
    });

    it('should update position text when agents exist', () => {
      const agent = createMockAgent(123, 456, 0, 0);
      overlay.update([agent]);
      expect(texts[1].setText).toHaveBeenCalledWith('Pos: 123, 456');
    });

    it('should round position values', () => {
      const agent = createMockAgent(123.4, 456.7, 0, 0);
      overlay.update([agent]);
      expect(texts[1].setText).toHaveBeenCalledWith('Pos: 123, 457');
    });

    it('should update velocity text when agents exist', () => {
      const agent = createMockAgent(0, 0, 50, -30);
      overlay.update([agent]);
      expect(texts[2].setText).toHaveBeenCalledWith('Vel: 50, -30');
    });

    it('should round velocity values', () => {
      const agent = createMockAgent(0, 0, 50.9, -30.1);
      overlay.update([agent]);
      expect(texts[2].setText).toHaveBeenCalledWith('Vel: 51, -30');
    });

    it('should not update position/velocity when no agents', () => {
      overlay.update([]);
      expect(texts[1].setText).not.toHaveBeenCalledWith(expect.stringContaining('Pos:'));
      expect(texts[2].setText).not.toHaveBeenCalledWith(expect.stringContaining('Vel:'));
    });

    it('should set all text visible when debug enabled', () => {
      overlay.update([]);
      texts.forEach(t => {
        expect(t.setVisible).toHaveBeenCalledWith(true);
      });
    });

    it('should skip rendering when debug disabled', () => {
      overlay.toggleDebug();
      texts.forEach(t => t.setText.mockClear());
      overlay.update([]);
      texts.forEach(t => {
        expect(t.setText).not.toHaveBeenCalled();
      });
    });

    it('should use first agent for display', () => {
      const agent1 = createMockAgent(100, 200, 10, 20);
      const agent2 = createMockAgent(300, 400, 30, 40);
      overlay.update([agent1, agent2]);
      expect(texts[1].setText).toHaveBeenCalledWith('Pos: 100, 200');
      expect(texts[2].setText).toHaveBeenCalledWith('Vel: 10, 20');
    });
  });

  describe('toggleDebug', () => {
    it('should toggle debug off', () => {
      overlay.toggleDebug();
      expect(texts[0].setVisible).toHaveBeenCalledWith(false);
      expect(texts[1].setVisible).toHaveBeenCalledWith(false);
      expect(texts[2].setVisible).toHaveBeenCalledWith(false);
    });

    it('should toggle physics debug draw', () => {
      overlay.toggleDebug();
      expect(mockScene.physics.world.drawDebug).toBe(false);
    });

    it('should toggle back on', () => {
      overlay.toggleDebug();
      overlay.toggleDebug();
      expect(texts[0].setVisible).toHaveBeenLastCalledWith(true);
      expect(mockScene.physics.world.drawDebug).toBe(true);
    });

    it('should disable updates after toggle off', () => {
      overlay.toggleDebug();
      overlay.update([createMockAgent(100, 200, 10, 20)]);
      expect(texts[0].setText).not.toHaveBeenCalled();
    });

    it('should re-enable updates after toggle on', () => {
      overlay.toggleDebug();
      overlay.toggleDebug();
      overlay.update([createMockAgent(100, 200, 10, 20)]);
      expect(texts[0].setText).toHaveBeenCalledWith('FPS: 60');
    });
  });

  describe('D key handler', () => {
    it('should call toggleDebug when D is pressed', () => {
      const handler = mockScene.input.keyboard!.on.mock.calls[0][1];
      handler();
      expect(texts[0].setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('edge cases', () => {
    it('should handle zero FPS', () => {
      mockScene.game.loop.actualFps = 0;
      overlay.update([]);
      expect(texts[0].setText).toHaveBeenCalledWith('FPS: 0');
    });

    it('should handle very high FPS', () => {
      mockScene.game.loop.actualFps = 144.9;
      overlay.update([]);
      expect(texts[0].setText).toHaveBeenCalledWith('FPS: 145');
    });

    it('should handle negative velocity', () => {
      const agent = createMockAgent(0, 0, -100, -200);
      overlay.update([agent]);
      expect(texts[2].setText).toHaveBeenCalledWith('Vel: -100, -200');
    });

    it('should handle zero position', () => {
      const agent = createMockAgent(0, 0, 0, 0);
      overlay.update([agent]);
      expect(texts[1].setText).toHaveBeenCalledWith('Pos: 0, 0');
      expect(texts[2].setText).toHaveBeenCalledWith('Vel: 0, 0');
    });
  });
});
