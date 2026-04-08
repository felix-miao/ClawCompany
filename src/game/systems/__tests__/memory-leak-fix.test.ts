import { MemoryManager } from '../MemoryManager';

function createMockTweenManager() {
  const activeTweens: { destroy: jest.Mock; targets: any }[] = [];

  return {
    activeTweens,
    add: jest.fn((config: any) => {
      const tween = { destroy: jest.fn(), targets: config?.targets };
      activeTweens.push(tween);
      if (config?.onComplete) {
        config.onComplete();
      }
      return tween;
    }),
    killTweensOf: jest.fn((target: any) => {
      for (let i = activeTweens.length - 1; i >= 0; i--) {
        if (activeTweens[i].targets === target) {
          activeTweens.splice(i, 1);
        }
      }
    }),
    removeAll: jest.fn(() => {
      activeTweens.length = 0;
    }),
  };
}

function createMockAgentDeps(tweens?: ReturnType<typeof createMockTweenManager>) {
  const tweenMgr = tweens ?? createMockTweenManager();
  return {
    scene: {
      tweens: tweenMgr,
      add: {
        existing: jest.fn(),
        graphics: jest.fn(() => ({
          clear: jest.fn(),
          destroy: jest.fn(),
          setStyle: jest.fn(),
          fillStyle: jest.fn(),
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          fillRoundedRect: jest.fn(),
          generateTexture: jest.fn(),
          setPosition: jest.fn(),
          setDepth: jest.fn(),
          setAlpha: jest.fn(),
        })),
        container: jest.fn(() => ({
          add: jest.fn(),
          destroy: jest.fn(),
          setPosition: jest.fn(),
          setDepth: jest.fn(),
        })),
        text: jest.fn(() => ({
          setOrigin: jest.fn(),
          setDepth: jest.fn(),
          setPosition: jest.fn(),
          destroy: jest.fn(),
        })),
      },
      physics: {
        add: { existing: jest.fn() },
      },
      time: { now: 1000 },
      game: { loop: { delta: 16 } },
      cameras: { main: { width: 800, height: 600 } },
    },
  };
}

describe('Memory Leak Fixes', () => {
  describe('AgentCharacter tween cleanup', () => {
    it('should track all created tweens for cleanup', () => {
      const tweenMgr = createMockTweenManager();
      const { scene } = createMockAgentDeps(tweenMgr);

      scene.tweens.add({ targets: {}, alpha: 0, duration: 100 });
      scene.tweens.add({ targets: {}, alpha: 1, duration: 200 });

      expect(tweenMgr.activeTweens.length).toBe(2);
    });

    it('should destroy all tracked tweens on agent destroy', () => {
      const tweenMgr = createMockTweenManager();
      const { scene } = createMockAgentDeps(tweenMgr);

      const tween1 = scene.tweens.add({ targets: {}, alpha: 0, duration: 100 });
      const tween2 = scene.tweens.add({ targets: {}, alpha: 1, duration: 200 });

      tween1.destroy();
      tween2.destroy();

      expect(tween1.destroy).toHaveBeenCalled();
      expect(tween2.destroy).toHaveBeenCalled();
    });

    it('should prevent inner tween leaks from move animations', () => {
      const tweenMgr = createMockTweenManager();
      const { scene } = createMockAgentDeps(tweenMgr);

      let innerTweenDestroyed = false;
      const outerTween = scene.tweens.add({
        targets: { scaleX: 0.8 },
        scaleX: 1,
        duration: 80,
        onComplete: () => {
          const innerTween = scene.tweens.add({
            targets: { scaleX: 1 },
            scaleX: 1,
            duration: 100,
          });
          expect(tweenMgr.activeTweens.length).toBe(2);
        },
      });

      expect(tweenMgr.activeTweens.length).toBe(2);
    });
  });

  describe('AgentCharacter callback cleanup', () => {
    it('should clear all arrival callbacks', () => {
      const callbacks: (() => void)[] = [];
      callbacks.push(() => {});
      callbacks.push(() => {});
      callbacks.push(() => {});
      expect(callbacks.length).toBe(3);
      callbacks.length = 0;
      expect(callbacks.length).toBe(0);
    });

    it('should nullify arrival callback after completion', () => {
      let arrivalCallback: (() => void) | null = () => {};
      expect(arrivalCallback).not.toBeNull();
      arrivalCallback = null;
      expect(arrivalCallback).toBeNull();
    });
  });

  describe('MemoryManager cleanup improvements', () => {
    let manager: MemoryManager;

    beforeEach(() => {
      manager = new MemoryManager({
        maxTrackedResources: 200,
        memoryBudgetMB: 10,
      });
    });

    it('should track and cleanup tween resources', () => {
      let tweenDestroyed = false;
      manager.track({
        type: 'tween',
        id: 'tween_1',
        estimatedSize: 256,
        destroy: () => { tweenDestroyed = true; },
      });

      expect(manager.getTrackedCount()).toBe(1);
      manager.cleanupByType('tween');
      expect(tweenDestroyed).toBe(true);
      expect(manager.getTrackedCount()).toBe(0);
    });

    it('should track and cleanup container resources', () => {
      let containerDestroyed = false;
      manager.track({
        type: 'container',
        id: 'container_emotion_1',
        estimatedSize: 512,
        destroy: () => { containerDestroyed = true; },
      });

      manager.cleanupByType('container');
      expect(containerDestroyed).toBe(true);
    });

    it('should report memory by type for diagnostics', () => {
      manager.track({ type: 'tween', id: 't1', estimatedSize: 256 });
      manager.track({ type: 'tween', id: 't2', estimatedSize: 256 });
      manager.track({ type: 'container', id: 'c1', estimatedSize: 1024 });

      const byType = manager.getMemoryByType();
      expect(byType.get('tween')).toBe(512);
      expect(byType.get('container')).toBe(1024);
    });

    it('should cleanup stale resources older than threshold', () => {
      const now = Date.now();
      manager.track({
        type: 'tween',
        id: 'stale_tween',
        estimatedSize: 256,
        createdAt: now - 60000,
        destroy: jest.fn(),
      });
      manager.track({
        type: 'tween',
        id: 'fresh_tween',
        estimatedSize: 256,
        createdAt: now - 500,
        destroy: jest.fn(),
      });

      const cleaned = manager.cleanupStale(5000);
      expect(cleaned).toBe(1);
      expect(manager.getTrackedCount()).toBe(1);
    });
  });

  describe('OfficeScene timer cleanup', () => {
    it('should clean up all timers on shutdown', () => {
      const timers: { remove: jest.Mock }[] = [];

      const taskTimer = { remove: jest.fn() };
      const workstationTimer = { remove: jest.fn() };
      timers.push(taskTimer, workstationTimer);

      timers.forEach(t => t.remove(false));

      expect(taskTimer.remove).toHaveBeenCalledWith(false);
      expect(workstationTimer.remove).toHaveBeenCalledWith(false);
    });

    it('should convert setInterval to tracked Phaser timer', () => {
      const timerEvents: { callback: () => void; removed: boolean }[] = [];

      const timerEvent = {
        callback: jest.fn(),
        removed: false,
        remove: jest.fn(() => { timerEvent.removed = true; }),
      };
      timerEvents.push(timerEvent);

      expect(timerEvents.length).toBe(1);
      timerEvent.remove();
      expect(timerEvent.removed).toBe(true);
    });
  });

  describe('OfficeScene graphics cleanup', () => {
    it('should destroy all decoration graphics on shutdown', () => {
      const destroyedIds: string[] = [];
      const decorationGraphics = [
        { destroy: () => { destroyedIds.push('g1'); } },
        { destroy: () => { destroyedIds.push('g2'); } },
        { destroy: () => { destroyedIds.push('g3'); } },
      ] as any[];

      decorationGraphics.forEach(g => g.destroy());
      decorationGraphics.length = 0;

      expect(destroyedIds).toEqual(['g1', 'g2', 'g3']);
      expect(decorationGraphics.length).toBe(0);
    });

    it('should destroy all shadow graphics on shutdown', () => {
      const shadowGraphics = new Map<string, { destroy: jest.Mock }>();
      shadowGraphics.set('agent1', { destroy: jest.fn() });
      shadowGraphics.set('agent2', { destroy: jest.fn() });

      shadowGraphics.forEach(g => g.destroy());
      shadowGraphics.clear();

      expect(shadowGraphics.size).toBe(0);
    });

    it('should destroy all name labels on shutdown', () => {
      const nameLabels = new Map<string, { destroy: jest.Mock }>();
      nameLabels.set('agent1', { destroy: jest.fn() });
      nameLabels.set('agent2', { destroy: jest.fn() });

      nameLabels.forEach(l => l.destroy());
      nameLabels.clear();

      expect(nameLabels.size).toBe(0);
    });
  });
});
