export type TaskStatus = 'pending' | 'assigned' | 'working' | 'reviewing' | 'completed' | 'failed';
export type TaskType = 'coding' | 'testing' | 'review' | 'meeting';

export interface TaskMetadata {
  files?: string[];
  estimatedDuration?: number;
  priority?: 'low' | 'medium' | 'high';
  dependencies?: string[];
}

export interface Task {
  id: string;
  agentId: string;
  description: string;
  status: TaskStatus;
  progress: number;
  currentAction: string;
  taskType: TaskType;
  assignedAt: number;
  completedAt: number | null;
  parentTaskId: string | null;
  metadata?: TaskMetadata;
}

export interface TaskCreateInput {
  description: string;
  taskType: TaskType;
  currentAction?: string;
  parentTaskId?: string | null;
  metadata?: TaskMetadata;
}
