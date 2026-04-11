import {
  gameStatusToLib,
  libStatusToGame,
  GAME_STATUS_VALUES,
  GAME_TO_LIB_STATUS,
  LIB_TO_GAME_STATUS,
  TaskStatus,
  TaskType,
  Task,
  TaskMetadata,
  TaskCreateInput,
} from '../../types/Task';

describe('Task Types', () => {
  describe('TaskStatus', () => {
    it('should have all expected status values', () => {
      expect(GAME_STATUS_VALUES).toContain('pending');
      expect(GAME_STATUS_VALUES).toContain('assigned');
      expect(GAME_STATUS_VALUES).toContain('working');
      expect(GAME_STATUS_VALUES).toContain('reviewing');
      expect(GAME_STATUS_VALUES).toContain('completed');
      expect(GAME_STATUS_VALUES).toContain('failed');
    });

    it('should have correct number of status values', () => {
      expect(GAME_STATUS_VALUES).toHaveLength(6);
    });
  });

  describe('TaskType', () => {
    it('should have valid task types', () => {
      const validTypes = ['coding', 'testing', 'review', 'meeting'];
      const task: Task = {
        id: 'test',
        agentId: 'agent1',
        description: 'Test',
        status: 'pending',
        progress: 0,
        currentAction: 'Idle',
        taskType: 'coding',
        assignedAt: 0,
        completedAt: null,
        parentTaskId: null,
      };

      validTypes.forEach(type => {
        expect(() => {
          task.taskType = type as TaskType;
        }).not.toThrow();
      });
    });
  });

  describe('Task', () => {
    it('should create a valid task object', () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        description: 'Implement login feature',
        status: 'pending',
        progress: 0,
        currentAction: 'Waiting',
        taskType: 'coding',
        assignedAt: Date.now(),
        completedAt: null,
        parentTaskId: null,
      };

      expect(task.id).toBe('task-1');
      expect(task.agentId).toBe('agent-1');
      expect(task.status).toBe('pending');
      expect(task.completedAt).toBeNull();
      expect(task.parentTaskId).toBeNull();
    });

    it('should support optional metadata', () => {
      const taskWithMetadata: Task = {
        id: 'task-2',
        agentId: 'agent-1',
        description: 'Write tests',
        status: 'working',
        progress: 50,
        currentAction: 'Writing tests',
        taskType: 'testing',
        assignedAt: Date.now(),
        completedAt: null,
        parentTaskId: null,
        metadata: {
          priority: 'high',
          estimatedDuration: 3600000,
          files: ['test.spec.ts'],
        },
      };

      expect(taskWithMetadata.metadata).toBeDefined();
      expect(taskWithMetadata.metadata?.priority).toBe('high');
      expect(taskWithMetadata.metadata?.estimatedDuration).toBe(3600000);
      expect(taskWithMetadata.metadata?.files).toContain('test.spec.ts');
    });

    it('should allow completedAt to be set', () => {
      const completedAt = Date.now();
      const task: Task = {
        id: 'task-3',
        agentId: 'agent-1',
        description: 'Completed task',
        status: 'completed',
        progress: 100,
        currentAction: 'Done',
        taskType: 'review',
        assignedAt: completedAt - 60000,
        completedAt,
        parentTaskId: null,
      };

      expect(task.completedAt).toBe(completedAt);
      expect(task.status).toBe('completed');
    });
  });

  describe('TaskMetadata', () => {
    it('should support all metadata fields', () => {
      const metadata: TaskMetadata = {
        files: ['src/index.ts', 'src/app.ts'],
        estimatedDuration: 7200000,
        priority: 'high',
        dependencies: ['task-1', 'task-2'],
        artifacts: [
          { type: 'code', name: 'index.ts', path: '/src/index.ts' },
          { type: 'html', name: 'index.html', path: '/dist/index.html', preview: '<html>...</html>' },
        ],
      };

      expect(metadata.files).toHaveLength(2);
      expect(metadata.estimatedDuration).toBe(7200000);
      expect(metadata.priority).toBe('high');
      expect(metadata.dependencies).toHaveLength(2);
      expect(metadata.artifacts).toHaveLength(2);
    });

    it('should allow partial metadata', () => {
      const minimalMetadata: TaskMetadata = {
        priority: 'low',
      };

      expect(minimalMetadata.files).toBeUndefined();
      expect(minimalMetadata.estimatedDuration).toBeUndefined();
      expect(minimalMetadata.priority).toBe('low');
    });
  });

  describe('TaskCreateInput', () => {
    it('should create valid input object', () => {
      const input: TaskCreateInput = {
        description: 'New feature implementation',
        taskType: 'coding',
        currentAction: 'Starting',
        parentTaskId: null,
        metadata: {
          priority: 'medium',
        },
      };

      expect(input.description).toBe('New feature implementation');
      expect(input.taskType).toBe('coding');
      expect(input.currentAction).toBe('Starting');
    });

    it('should allow minimal input', () => {
      const minimalInput: TaskCreateInput = {
        description: 'Simple task',
        taskType: 'meeting',
      };

      expect(minimalInput.currentAction).toBeUndefined();
      expect(minimalInput.parentTaskId).toBeUndefined();
      expect(minimalInput.metadata).toBeUndefined();
    });
  });

  describe('Status conversion functions', () => {
    describe('gameStatusToLib', () => {
      it('should convert pending status', () => {
        expect(gameStatusToLib('pending')).toBe('pending');
      });

      it('should convert assigned status to pending', () => {
        expect(gameStatusToLib('assigned')).toBe('pending');
      });

      it('should convert working status to in_progress', () => {
        expect(gameStatusToLib('working')).toBe('in_progress');
      });

      it('should convert reviewing status to review', () => {
        expect(gameStatusToLib('reviewing')).toBe('review');
      });

      it('should convert completed status', () => {
        expect(gameStatusToLib('completed')).toBe('completed');
      });

      it('should convert failed status', () => {
        expect(gameStatusToLib('failed')).toBe('failed');
      });
    });

    describe('libStatusToGame', () => {
      it('should convert pending status', () => {
        expect(libStatusToGame('pending')).toBe('pending');
      });

      it('should convert in_progress status to working', () => {
        expect(libStatusToGame('in_progress')).toBe('working');
      });

      it('should convert review status to reviewing', () => {
        expect(libStatusToGame('review')).toBe('reviewing');
      });

      it('should convert completed status', () => {
        expect(libStatusToGame('completed')).toBe('completed');
      });

      it('should convert failed status', () => {
        expect(libStatusToGame('failed')).toBe('failed');
      });
    });

    describe('GAME_TO_LIB_STATUS mapping', () => {
      it('should map all game statuses to lib statuses', () => {
        expect(GAME_TO_LIB_STATUS['pending']).toBe('pending');
        expect(GAME_TO_LIB_STATUS['assigned']).toBe('pending');
        expect(GAME_TO_LIB_STATUS['working']).toBe('in_progress');
        expect(GAME_TO_LIB_STATUS['reviewing']).toBe('review');
        expect(GAME_TO_LIB_STATUS['completed']).toBe('completed');
        expect(GAME_TO_LIB_STATUS['failed']).toBe('failed');
      });
    });

    describe('LIB_TO_GAME_STATUS mapping', () => {
      it('should map all lib statuses to game statuses', () => {
        expect(LIB_TO_GAME_STATUS['pending']).toBe('pending');
        expect(LIB_TO_GAME_STATUS['in_progress']).toBe('working');
        expect(LIB_TO_GAME_STATUS['review']).toBe('reviewing');
        expect(LIB_TO_GAME_STATUS['completed']).toBe('completed');
        expect(LIB_TO_GAME_STATUS['failed']).toBe('failed');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle all priority values', () => {
      const priorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      priorities.forEach(priority => {
        const task: Task = {
          id: 'test',
          agentId: 'agent',
          description: 'Test',
          status: 'pending',
          progress: 0,
          currentAction: 'Idle',
          taskType: 'coding',
          assignedAt: Date.now(),
          completedAt: null,
          parentTaskId: null,
          metadata: { priority },
        };

        expect(task.metadata?.priority).toBe(priority);
      });
    });

    it('should handle task with parent task ID', () => {
      const parentTask: Task = {
        id: 'parent-1',
        agentId: 'agent-1',
        description: 'Parent task',
        status: 'completed',
        progress: 100,
        currentAction: 'Done',
        taskType: 'coding',
        assignedAt: Date.now() - 100000,
        completedAt: Date.now(),
        parentTaskId: null,
      };

      const childTask: Task = {
        id: 'child-1',
        agentId: 'agent-2',
        description: 'Child task',
        status: 'pending',
        progress: 0,
        currentAction: 'Waiting',
        taskType: 'testing',
        assignedAt: Date.now(),
        completedAt: null,
        parentTaskId: 'parent-1',
      };

      expect(childTask.parentTaskId).toBe('parent-1');
      expect(parentTask.parentTaskId).toBeNull();
    });

    it('should handle artifact types', () => {
      const artifactTypes: Array<'html' | 'code' | 'image' | 'file'> = ['html', 'code', 'image', 'file'];

      artifactTypes.forEach(type => {
        const artifact = {
          type,
          name: `test.${type === 'code' ? 'ts' : type === 'html' ? 'html' : type === 'image' ? 'png' : 'pdf'}`,
          path: `/path/to/file.${type === 'code' ? 'ts' : type === 'html' ? 'html' : type === 'image' ? 'png' : 'pdf'}`,
        };

        expect(artifact.type).toBe(type);
      });
    });
  });
});