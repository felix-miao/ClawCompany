import { TaskStatisticsPanel } from '../TaskStatisticsPanel';
import { TaskStatisticsStore, TaskStatistics } from '../../data/TaskStatisticsStore';

jest.mock('../TaskHistoryPanel', () => ({
  TaskHistoryPanel: {
    formatDuration: (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        return `${minutes}分${seconds % 60}秒`;
      }
      return `${seconds}秒`;
    },
  },
}));

const mockScene = {
  add: {
    text: jest.fn(() => ({
      destroy: jest.fn(),
      setText: jest.fn(),
    })),
    graphics: jest.fn(() => ({
      clear: jest.fn(),
      fillStyle: jest.fn(),
      fillRoundedRect: jest.fn(),
      destroy: jest.fn(),
    })),
    container: jest.fn(() => ({
      setDepth: jest.fn(),
      setVisible: jest.fn(),
      setPosition: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      destroy: jest.fn(),
      getAll: jest.fn(() => []),
    })),
  },
  tweens: {
    add: jest.fn(),
  },
} as any;

describe('TaskStatisticsPanel', () => {
  let mockStore: TaskStatisticsStore;
  let panel: TaskStatisticsPanel;
  let mockStatistics: TaskStatistics;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStatistics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageDuration: 0,
      successRate: 0,
      agentDistribution: new Map(),
    };

    mockStore = {
      getStatistics: jest.fn(() => mockStatistics),
      update: jest.fn(),
    } as any;

    panel = new TaskStatisticsPanel(mockScene, mockStore);
  });

  describe('show and hide', () => {
    it('should be hidden initially', () => {
      expect(panel.isVisible()).toBe(false);
    });

    it('should show and hide panel', () => {
      panel.show();
      expect(panel.isVisible()).toBe(true);

      panel.hide();
      expect(panel.isVisible()).toBe(false);
    });
  });

  describe('update', () => {
    it('should not call store update when hidden', () => {
      panel.update();
      expect(mockStore.update).not.toHaveBeenCalled();
    });

    it('should call store update when visible', () => {
      panel.show();
      panel.update();
      expect(mockStore.update).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy panel', () => {
      panel.show();
      panel.destroy();
      expect(panel.isDestroyed()).toBe(true);
    });

    it('should not respond to show/hide after destroy', () => {
      panel.destroy();
      expect(() => panel.show()).not.toThrow();
      expect(() => panel.hide()).not.toThrow();
      expect(panel.isVisible()).toBe(false);
    });

    it('should handle double destroy', () => {
      panel.destroy();
      expect(() => panel.destroy()).not.toThrow();
    });
  });

  describe('statistics display', () => {
    it('should get statistics on show', () => {
      mockStatistics = {
        totalTasks: 5,
        completedTasks: 3,
        failedTasks: 1,
        averageDuration: 45000,
        successRate: 75.5,
        agentDistribution: new Map([['pm', 2], ['dev', 3]]),
      };
      (mockStore.getStatistics as jest.Mock).mockReturnValue(mockStatistics);

      panel.show();

      expect(mockStore.getStatistics).toHaveBeenCalled();
      expect(mockStore.update).toHaveBeenCalled();
    });

    it('should handle empty statistics', () => {
      (mockStore.getStatistics as jest.Mock).mockReturnValue({
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageDuration: 0,
        successRate: 0,
        agentDistribution: new Map(),
      });

      panel.show();
      expect(panel.isVisible()).toBe(true);
    });
  });

  describe('setPosition', () => {
    it('should set position', () => {
      panel.setPosition(100, 200);
      expect(mockScene.add.container).toHaveBeenCalled();
    });
  });
});
