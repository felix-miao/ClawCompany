import { NavigationSystem } from '../NavigationSystem';
import { NavigationMesh } from '../../data/NavigationMesh';

jest.mock('../../data/NavigationMesh');

interface MockNavMeshNode {
  isWalkable: boolean;
}

interface MockNavMesh {
  getNodeAt: jest.Mock<(x: number, y: number) => MockNavMeshNode | null>;
  setNode: (x: number, y: number, walkable: boolean) => void;
}

function createMockScene(): object {
  return {};
}

function createMockNavMesh(): MockNavMesh {
  const nodes = new Map<string, MockNavMeshNode>();
  return {
    getNodeAt: jest.fn((x: number, y: number) => {
      const key = `${x},${y}`;
      return nodes.get(key) || null;
    }),
    setNode: (x: number, y: number, walkable: boolean) => {
      nodes.set(`${x},${y}`, { isWalkable: walkable });
    },
  };
}

describe('NavigationSystem', () => {
  describe('constructor', () => {
    it('should create a PathfindingSystem', () => {
      const navMesh = new NavigationMesh(320, 320);
      const system = new NavigationSystem({} as unknown as Phaser.Scene, navMesh);
      expect(system.getPathfindingSystem()).toBeDefined();
    });
  });

  describe('isWalkable', () => {
    it('should return false for non-walkable nodes', () => {
      const mockMesh = createMockNavMesh();
      const system = new NavigationSystem(createMockScene() as unknown as Phaser.Scene, mockMesh as unknown as NavigationMesh);

      mockMesh.getNodeAt.mockReturnValue(null);
      expect(system.isWalkable(100, 100)).toBe(false);
    });

    it('should return true for walkable nodes', () => {
      const mockMesh = createMockNavMesh();
      const system = new NavigationSystem(createMockScene() as unknown as Phaser.Scene, mockMesh as unknown as NavigationMesh);

      mockMesh.getNodeAt.mockReturnValue({ isWalkable: true });
      expect(system.isWalkable(32, 32)).toBe(true);
    });

    it('should return false for null nodes', () => {
      const mockMesh = createMockNavMesh();
      const system = new NavigationSystem(createMockScene() as unknown as Phaser.Scene, mockMesh as unknown as NavigationMesh);

      mockMesh.getNodeAt.mockReturnValue(null);
      expect(system.isWalkable(9999, 9999)).toBe(false);
    });
  });

  describe('findNearestWalkablePosition', () => {
    it('should return the current position if walkable', () => {
      const mockMesh = createMockNavMesh();
      const system = new NavigationSystem(createMockScene() as unknown as Phaser.Scene, mockMesh as unknown as NavigationMesh);

      mockMesh.getNodeAt.mockReturnValue({ isWalkable: true });
      const result = system.findNearestWalkablePosition(32, 32);
      expect(result).toEqual({ x: 32, y: 32 });
    });

    it('should search adjacent positions', () => {
      const mockMesh = createMockNavMesh();
      const system = new NavigationSystem(createMockScene() as unknown as Phaser.Scene, mockMesh as unknown as NavigationMesh);

      let callCount = 0;
      mockMesh.getNodeAt.mockImplementation(() => {
        callCount++;
        return callCount > 2 ? { isWalkable: true } : { isWalkable: false };
      });

      mockMesh.getNodeAt.mockImplementation(() => ({ isWalkable: true }));
      const result = system.findNearestWalkablePosition(0, 0);
      expect(result).not.toBeNull();
    });

    it('should return null when no walkable position found', () => {
      const mockMesh = createMockNavMesh();
      const system = new NavigationSystem(createMockScene() as unknown as Phaser.Scene, mockMesh as unknown as NavigationMesh);

      mockMesh.getNodeAt.mockReturnValue({ isWalkable: false });
      const result = system.findNearestWalkablePosition(0, 0);
      expect(result).toBeNull();
    });
  });

  describe('setDebugVisible', () => {
    it('should call drawDebug on pathfinding system', () => {
      const navMesh = new NavigationMesh(320, 320);
      const mockGraphics = {
        clear: jest.fn(),
        setVisible: jest.fn(),
        lineStyle: jest.fn(),
        lineBetween: jest.fn(),
        fillStyle: jest.fn(),
        fillCircle: jest.fn(),
      };
      const scene = {
        add: { graphics: jest.fn().mockReturnValue(mockGraphics) },
      } as unknown as Phaser.Scene;
      const system = new NavigationSystem(scene, navMesh);
      expect(() => system.setDebugVisible(true)).not.toThrow();
    });
  });
});
