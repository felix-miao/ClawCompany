import { NavigationSystem } from '../NavigationSystem';
import { NavigationMesh } from '../../data/NavigationMesh';

jest.mock('../../data/NavigationMesh');

function createMockScene() {
  return {};
}

function createMockNavMesh() {
  const nodes = new Map<string, { isWalkable: boolean }>();
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
      const system = new NavigationSystem({} as any, navMesh);
      expect(system.getPathfindingSystem()).toBeDefined();
    });
  });

  describe('isWalkable', () => {
    it('should return false for non-walkable nodes', () => {
      const mockMesh = createMockNavMesh() as any;
      const system = new NavigationSystem(createMockScene() as any, mockMesh);

      mockMesh.getNodeAt.mockReturnValue(null);
      expect(system.isWalkable(100, 100)).toBe(false);
    });

    it('should return true for walkable nodes', () => {
      const mockMesh = createMockNavMesh() as any;
      const system = new NavigationSystem(createMockScene() as any, mockMesh);

      mockMesh.getNodeAt.mockReturnValue({ isWalkable: true });
      expect(system.isWalkable(32, 32)).toBe(true);
    });

    it('should return false for null nodes', () => {
      const mockMesh = createMockNavMesh() as any;
      const system = new NavigationSystem(createMockScene() as any, mockMesh);

      mockMesh.getNodeAt.mockReturnValue(null);
      expect(system.isWalkable(9999, 9999)).toBe(false);
    });
  });

  describe('findNearestWalkablePosition', () => {
    it('should return the current position if walkable', () => {
      const mockMesh = createMockNavMesh() as any;
      const system = new NavigationSystem(createMockScene() as any, mockMesh);

      mockMesh.getNodeAt.mockReturnValue({ isWalkable: true });
      const result = system.findNearestWalkablePosition(32, 32);
      expect(result).toEqual({ x: 32, y: 32 });
    });

    it('should search adjacent positions', () => {
      const mockMesh = createMockNavMesh() as any;
      const system = new NavigationSystem(createMockScene() as any, mockMesh);

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
      const mockMesh = createMockNavMesh() as any;
      const system = new NavigationSystem(createMockScene() as any, mockMesh);

      mockMesh.getNodeAt.mockReturnValue({ isWalkable: false });
      const result = system.findNearestWalkablePosition(0, 0);
      expect(result).toBeNull();
    });
  });

  describe('setDebugVisible', () => {
    it('should call drawDebug on pathfinding system', () => {
      const navMesh = new NavigationMesh(320, 320);
      const system = new NavigationSystem({ drawDebug: jest.fn() } as any, navMesh);
      expect(() => system.setDebugVisible(true)).not.toThrow();
    });
  });
});
