import { NavigationDebug, NavigationDebugConfig } from '../NavigationDebug';

function createMockGraphics() {
  return {
    setVisible: jest.fn().mockReturnThis(),
    clear: jest.fn().mockReturnThis(),
    fillStyle: jest.fn().mockReturnThis(),
    fillCircle: jest.fn().mockReturnThis(),
    lineStyle: jest.fn().mockReturnThis(),
    strokeCircle: jest.fn().mockReturnThis(),
    beginPath: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    strokePath: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };
}

function createMockText() {
  return {
    setText: jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    setVisible: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };
}

function createMockScene() {
  const mockGraphics = createMockGraphics();
  const createdTexts: ReturnType<typeof createMockText>[] = [];
  const scene = {
    add: {
      graphics: jest.fn().mockReturnValue(mockGraphics),
      text: jest.fn().mockImplementation(() => {
        const t = createMockText();
        createdTexts.push(t);
        return t;
      }),
    },
  };
  return { scene, mockGraphics, createdTexts };
}

function createMockAgent(options: {
  x?: number;
  y?: number;
  targetPosition?: { x: number; y: number } | null;
  currentPath?: any[];
  navigationState?: string;
  isNavigating?: boolean;
  body?: any;
}) {
  return {
    x: options.x ?? 100,
    y: options.y ?? 200,
    getTargetPosition: jest.fn().mockReturnValue(options.targetPosition ?? null),
    getCurrentPath: jest.fn().mockReturnValue(options.currentPath ?? []),
    getNavigationState: jest.fn().mockReturnValue(options.navigationState ?? 'idle'),
    isNavigatingToTarget: jest.fn().mockReturnValue(options.isNavigating ?? false),
    body: options.body ?? { velocity: { x: 0, y: 0 } },
  } as any;
}

describe('NavigationDebug', () => {
  let debug: NavigationDebug;
  let mockScene: ReturnType<typeof createMockScene>['scene'];
  let mockGraphics: ReturnType<typeof createMockGraphics>;
  let createdTexts: ReturnType<typeof createMockText>[];

  beforeEach(() => {
    const result = createMockScene();
    mockScene = result.scene;
    mockGraphics = result.mockGraphics;
    createdTexts = result.createdTexts;
    debug = new NavigationDebug(mockScene as any);
  });

  describe('constructor', () => {
    it('should create a graphics object', () => {
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should use default config', () => {
      const result = createMockScene();
      const d = new NavigationDebug(result.scene as any);
      const agent = createMockAgent({ targetPosition: { x: 50, y: 60 } });
      d.setAgents([agent]);
      d.update();
      expect(result.mockGraphics.fillCircle).toHaveBeenCalled();
    });

    it('should merge custom config with defaults', () => {
      const result = createMockScene();
      const d = new NavigationDebug(result.scene as any, { showTargetPosition: false });
      const agent = createMockAgent({ targetPosition: { x: 50, y: 60 } });
      d.setAgents([agent]);
      d.update();
      expect(result.mockGraphics.fillCircle).not.toHaveBeenCalled();
    });
  });

  describe('setAgents', () => {
    it('should store agents', () => {
      const agent = createMockAgent({});
      debug.setAgents([agent]);
      debug.update();
      expect(agent.getTargetPosition).toHaveBeenCalled();
    });

    it('should handle empty array', () => {
      debug.setAgents([]);
      debug.update();
      expect(mockGraphics.clear).toHaveBeenCalled();
    });

    it('should replace previous agents', () => {
      const agent1 = createMockAgent({});
      const agent2 = createMockAgent({});
      debug.setAgents([agent1]);
      debug.setAgents([agent2]);
      debug.update();
      expect(agent2.getTargetPosition).toHaveBeenCalled();
    });
  });

  describe('update - visibility', () => {
    it('should hide graphics and text when not visible', () => {
      debug.setVisible(false);
      debug.update();
      expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
    });

    it('should show graphics when visible', () => {
      debug.update();
      expect(mockGraphics.setVisible).toHaveBeenCalledWith(true);
    });

    it('should clear graphics on each update', () => {
      debug.update();
      expect(mockGraphics.clear).toHaveBeenCalled();
    });
  });

  describe('drawAgentDebug - target position', () => {
    it('should draw target position circle when agent has target', () => {
      const agent = createMockAgent({ targetPosition: { x: 50, y: 60 } });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0xffff00, 0.6);
      expect(mockGraphics.fillCircle).toHaveBeenCalledWith(50, 60, 8);
      expect(mockGraphics.strokeCircle).toHaveBeenCalledWith(50, 60, 12);
    });

    it('should not draw target when config disabled', () => {
      const d = new NavigationDebug(mockScene as any, { showTargetPosition: false });
      const agent = createMockAgent({ targetPosition: { x: 50, y: 60 } });
      d.setAgents([agent]);
      d.update();
      expect(mockGraphics.fillCircle).not.toHaveBeenCalled();
    });

    it('should not draw target when agent has no target', () => {
      const agent = createMockAgent({ targetPosition: null });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.fillCircle).not.toHaveBeenCalled();
    });
  });

  describe('drawAgentDebug - path', () => {
    it('should draw path lines when agent has path', () => {
      const agent = createMockAgent({
        x: 100,
        y: 200,
        currentPath: [
          { x: 150, y: 200, action: 'move' },
          { x: 200, y: 200, action: 'move' },
        ],
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.beginPath).toHaveBeenCalled();
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(100, 200);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(150, 200);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(200, 200);
      expect(mockGraphics.strokePath).toHaveBeenCalled();
    });

    it('should color jump waypoints red', () => {
      const agent = createMockAgent({
        x: 100,
        y: 200,
        currentPath: [{ x: 150, y: 150, action: 'jump' }],
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0xff0000, 0.8);
    });

    it('should color move waypoints green', () => {
      const agent = createMockAgent({
        x: 100,
        y: 200,
        currentPath: [{ x: 150, y: 200, action: 'move' }],
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 0.8);
    });

    it('should not draw path when config disabled', () => {
      const d = new NavigationDebug(mockScene as any, { showPath: false });
      const agent = createMockAgent({
        currentPath: [{ x: 150, y: 200, action: 'move' }],
      });
      d.setAgents([agent]);
      d.update();
      expect(mockGraphics.beginPath).not.toHaveBeenCalled();
    });

    it('should not draw path when path is empty', () => {
      const agent = createMockAgent({ currentPath: [] });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.beginPath).not.toHaveBeenCalled();
    });
  });

  describe('drawAgentDebug - state', () => {
    it('should show NAV state when agent is navigating', () => {
      const agent = createMockAgent({
        x: 100,
        y: 200,
        isNavigating: true,
        navigationState: 'moving',
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockScene.add.text).toHaveBeenCalled();
    });

    it('should show IDLE when agent is not navigating', () => {
      const agent = createMockAgent({
        x: 100,
        y: 200,
        isNavigating: false,
        navigationState: 'idle',
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockScene.add.text).toHaveBeenCalled();
    });

    it('should not show state when config disabled', () => {
      const d = new NavigationDebug(mockScene as any, { showState: false });
      const agent = createMockAgent({ isNavigating: true, navigationState: 'moving' });
      d.setAgents([agent]);
      d.update();
      expect(mockScene.add.text).not.toHaveBeenCalled();
    });

    it('should reuse text object for same agent index', () => {
      const agent = createMockAgent({ isNavigating: true, navigationState: 'moving' });
      debug.setAgents([agent]);
      debug.update();
      debug.update();
      expect(mockScene.add.text).toHaveBeenCalledTimes(1);
    });
  });

  describe('drawAgentDebug - velocity', () => {
    it('should draw velocity vector when enabled', () => {
      const d = new NavigationDebug(mockScene as any, { showVelocity: true });
      const agent = createMockAgent({
        x: 100,
        y: 200,
        body: { velocity: { x: 50, y: -30 } },
      });
      d.setAgents([agent]);
      d.update();
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(100, 200);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(105, 197);
    });

    it('should not draw velocity by default', () => {
      const agent = createMockAgent({
        body: { velocity: { x: 50, y: -30 } },
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.lineStyle).not.toHaveBeenCalledWith(2, 0x00ffff, 1);
    });

    it('should not draw velocity when body is null', () => {
      const d = new NavigationDebug(mockScene as any, { showVelocity: true });
      const agent = createMockAgent({});
      Object.defineProperty(agent, 'body', { value: null });
      d.setAgents([agent]);
      d.update();
      expect(mockGraphics.strokePath).not.toHaveBeenCalled();
    });
  });

  describe('ensureTextObject', () => {
    it('should create text for new index', () => {
      const agents = [
        createMockAgent({ isNavigating: true, navigationState: 'moving' }),
        createMockAgent({ isNavigating: false, navigationState: 'idle' }),
      ];
      debug.setAgents(agents);
      debug.update();
      expect(mockScene.add.text).toHaveBeenCalledTimes(2);
    });
  });

  describe('setVisible', () => {
    it('should set visible to false', () => {
      debug.setVisible(false);
      expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
    });

    it('should set visible to true', () => {
      debug.setVisible(true);
      expect(mockGraphics.setVisible).toHaveBeenCalledWith(true);
    });

    it('should hide all text objects', () => {
      const agent = createMockAgent({ isNavigating: true, navigationState: 'moving' });
      debug.setAgents([agent]);
      debug.update();
      debug.setVisible(false);
      createdTexts.forEach(t => {
        expect(t.setVisible).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('toggle', () => {
    it('should toggle visibility', () => {
      debug.toggle();
      expect(mockGraphics.setVisible).toHaveBeenCalledWith(false);
    });

    it('should toggle back', () => {
      debug.toggle();
      debug.toggle();
      expect(mockGraphics.setVisible).toHaveBeenLastCalledWith(true);
    });
  });

  describe('updateConfig', () => {
    it('should merge new config', () => {
      debug.updateConfig({ showTargetPosition: false, showPath: false });
      const agent = createMockAgent({
        targetPosition: { x: 50, y: 60 },
        currentPath: [{ x: 150, y: 200, action: 'move' }],
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.fillCircle).not.toHaveBeenCalled();
      expect(mockGraphics.beginPath).not.toHaveBeenCalled();
    });

    it('should preserve existing config values', () => {
      debug.updateConfig({ showTargetPosition: false });
      const agent = createMockAgent({
        currentPath: [{ x: 150, y: 200, action: 'move' }],
      });
      debug.setAgents([agent]);
      debug.update();
      expect(mockGraphics.beginPath).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy graphics', () => {
      debug.destroy();
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });

    it('should destroy all text objects', () => {
      const agent = createMockAgent({ isNavigating: true, navigationState: 'moving' });
      debug.setAgents([agent]);
      debug.update();
      debug.destroy();
      createdTexts.forEach(t => {
        expect(t.destroy).toHaveBeenCalled();
      });
    });

    it('should handle destroy with no text objects', () => {
      debug.destroy();
      expect(mockGraphics.destroy).toHaveBeenCalled();
    });
  });

  describe('multiple agents', () => {
    it('should draw debug for all agents', () => {
      const agents = [
        createMockAgent({ x: 100, y: 200, targetPosition: { x: 50, y: 60 } }),
        createMockAgent({ x: 300, y: 400, targetPosition: { x: 250, y: 350 } }),
      ];
      debug.setAgents(agents);
      debug.update();
      expect(mockGraphics.fillCircle).toHaveBeenCalledTimes(2);
    });

    it('should handle agents with mixed states', () => {
      const agents = [
        createMockAgent({ targetPosition: null, currentPath: [] }),
        createMockAgent({
          targetPosition: { x: 50, y: 60 },
          currentPath: [{ x: 60, y: 60, action: 'move' }],
        }),
      ];
      debug.setAgents(agents);
      debug.update();
      expect(mockGraphics.fillCircle).toHaveBeenCalled();
    });
  });
});
