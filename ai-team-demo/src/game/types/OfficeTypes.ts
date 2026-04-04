export type RoomName = 'pm-office' | 'dev-studio' | 'test-lab' | 'review-center';

export type { GameTaskType as TaskType } from '../../lib/core/types'

export interface Workstation {
  id: string;
  x: number;
  y: number;
  label: string;
  status: 'idle' | 'busy';
  taskType: TaskType;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
}

export interface TilemapData {
  width: number;
  height: number;
  tileSize: number;
  workstations: Workstation[];
  platforms: Platform[];
}

export interface ActiveTask {
  agentId: string;
  targetX: number;
  targetY: number;
  returning: boolean;
}
