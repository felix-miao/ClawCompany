export type { GameTaskStatus as TaskStatus } from '../../lib/core/types';
export { gameStatusToLib, libStatusToGame, GAME_STATUS_VALUES, GAME_TO_LIB_STATUS, LIB_TO_GAME_STATUS } from '../../lib/core/types';
import type { GameTaskStatus } from '../../lib/core/types';
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
