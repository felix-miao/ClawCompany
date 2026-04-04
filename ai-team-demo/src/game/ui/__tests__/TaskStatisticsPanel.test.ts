import { TaskStatisticsPanel } from '../TaskStatisticsPanel';
import { TaskStatisticsStore, TaskStatistics } from '../../data/TaskStatisticsStore';

// 简化的Scene mock
const mockScene = {
  add: {
    text: jest.fn(() => ({ 
      destroy: jest.fn(),
      setText: jest.fn()
    })),
    graphics: jest.fn(() => {
      const g: any = {
        clear: jest.fn(),
        destroy: jest.fn()
      };
      // 链式调用方法
      g.fillStyle = jest.fn(() => g);
      g.beginPath = jest.fn(() => g);
      g.moveTo = jest.fn(() => g);
      g.lineTo = jest.fn(() => g);
      g.arc = jest.fn(() => g);
      g.closePath = jest.fn(() => g);
      g.fillPath = jest.fn(() => g);
      return g;
    }),
    container: jest.fn(() => ({ 
      setDepth: jest.fn(), 
      setVisible: jest.fn(),
      setPosition: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      destroy: jest.fn(),
      getAll: jest.fn(() => []),
      length: 0
    })),
  },
  tweens: {
    add: jest.fn()
  }
} as any;

describe('TaskStatisticsPanel', () => {
  let mockStore: TaskStatisticsStore;
  let panel: TaskStatisticsPanel;
  let mockStatistics: TaskStatistics;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 设置默认的mock返回值
    mockStatistics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageDuration: 0,
      successRate: 0,
      agentDistribution: new Map()
    };
    
    mockStore = {
      getStatistics: jest.fn(() => mockStatistics),
      update: jest.fn()
    } as any;

    panel = new TaskStatisticsPanel(mockScene, mockStore);
  });

  describe('基本功能', () => {
    it('初始状态应该是隐藏的', () => {
      expect(panel.isVisible()).toBe(false);
    });

    it('应该能够显示和隐藏面板', () => {
      panel.show();
      expect(panel.isVisible()).toBe(true);

      panel.hide();
      expect(panel.isVisible()).toBe(false);
    });
  });

  describe('更新功能', () => {
    it('在隐藏状态下不应该调用统计更新', () => {
      panel.update();
      
      expect(mockStore.update).not.toHaveBeenCalled();
    });

    it('在显示状态下应该调用统计更新', () => {
      panel.show();
      panel.update();
      
      expect(mockStore.update).toHaveBeenCalled();
    });
  });

  describe('销毁功能', () => {
    it('应该能够销毁面板', () => {
      panel.show();
      
      panel.destroy();
      
      expect(panel.isDestroyed()).toBe(true);
    });

    it('销毁后不应该响应show/hide', () => {
      panel.destroy();
      
      expect(() => panel.show()).not.toThrow();
      expect(() => panel.hide()).not.toThrow();
      
      expect(panel.isVisible()).toBe(false);
    });

    it('重复销毁不应该报错', () => {
      panel.destroy();
      expect(() => panel.destroy()).not.toThrow();
    });
  });

  describe('统计数据显示', () => {
    it('显示时应该获取统计数据', () => {
      mockStatistics = {
        totalTasks: 5,
        completedTasks: 3,
        failedTasks: 1,
        averageDuration: 45000,
        successRate: 75.5,
        agentDistribution: new Map([
          ['pm', 2],
          ['dev', 3]
        ])
      };
      mockStore.getStatistics.mockReturnValue(mockStatistics);
      
      panel.show();
      
      expect(mockStore.getStatistics).toHaveBeenCalled();
      expect(mockStore.update).toHaveBeenCalled();
    });

    it('应该正确处理空统计信息', () => {
      mockStatistics = {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageDuration: 0,
        successRate: 0,
        agentDistribution: new Map()
      };
      mockStore.getStatistics.mockReturnValue(mockStatistics);
      
      panel.show();
      
      expect(panel.isVisible()).toBe(true);
    });
  });

  describe('位置设置', () => {
    it('应该能够设置位置', () => {
      panel.setPosition(100, 200);
      
      expect(mockScene.add.container).toHaveBeenCalled();
    });
  });
});