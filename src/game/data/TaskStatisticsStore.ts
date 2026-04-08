import { TaskHistoryStore } from './TaskHistoryStore';

export interface TaskStatistics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageDuration: number;
  successRate: number;
  agentDistribution: Map<string, number>;
}

export class TaskStatisticsStore {
  private historyStore: TaskHistoryStore;
  private statistics: TaskStatistics;

  constructor(historyStore: TaskHistoryStore) {
    this.historyStore = historyStore;
    this.statistics = this.calculateStatistics();
  }

  private calculateStatistics(): TaskStatistics {
    const records = this.historyStore.getRecords();

    const totalTasks = records.length;
    const completedTasks = records.filter(r => r.task.status === 'completed').length;
    const failedTasks = records.filter(r => r.task.status === 'failed').length;

    const totalDuration = records.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalTasks > 0 ? totalDuration / totalTasks : 0;

    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const agentDistribution = new Map<string, number>();
    records.forEach(r => {
      r.handoffs.forEach(agentId => {
        agentDistribution.set(agentId, (agentDistribution.get(agentId) || 0) + 1);
      });
      if (r.handoffs.length === 0) {
        agentDistribution.set(r.task.agentId, (agentDistribution.get(r.task.agentId) || 0) + 1);
      }
    });

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      averageDuration,
      successRate,
      agentDistribution,
    };
  }

  getStatistics(): TaskStatistics {
    return this.statistics;
  }

  update(): void {
    this.statistics = this.calculateStatistics();
  }
}
