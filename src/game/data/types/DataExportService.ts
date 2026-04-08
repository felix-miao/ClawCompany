import { TaskStatus } from '../../types/Task';

export interface ExportFilters {
  dateRange?: { start: number; end: number };
  agentId?: string;
  status?: TaskStatus;
  taskType?: string;
  eventType?: string;
}
