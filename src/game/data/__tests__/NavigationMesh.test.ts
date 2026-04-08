import { NavigationMesh } from '../NavigationMesh';
import { TILE_SIZE } from '../../config/gameConfig';

describe('NavigationMesh', () => {
  describe('constructor', () => {
    it('should create a grid with correct dimensions', () => {
      const mesh = new NavigationMesh(640, 480);
      expect(mesh.getGridWidth()).toBe(Math.ceil(640 / TILE_SIZE));
      expect(mesh.getGridHeight()).toBe(Math.ceil(480 / TILE_SIZE));
    });

    it('should initialize all nodes as walkable', () => {
      const mesh = new NavigationMesh(320, 320);
      const node = mesh.getNodeAt(0, 0);
      expect(node?.isWalkable).toBe(true);
    });

    it('should initialize nodes with correct world coordinates', () => {
      const mesh = new NavigationMesh(320, 320);
      const node = mesh.getNodeAt(1, 1);
      expect(node?.x).toBe(1 * TILE_SIZE + TILE_SIZE / 2);
      expect(node?.y).toBe(1 * TILE_SIZE + TILE_SIZE / 2);
    });
  });

  describe('setWalkable', () => {
    it('should set walkable flag', () => {
      const mesh = new NavigationMesh(320, 320);
      mesh.setWalkable(2, 3, false);
      expect(mesh.getNodeAt(2, 3)?.isWalkable).toBe(false);
    });

    it('should ignore out-of-bounds coordinates', () => {
      const mesh = new NavigationMesh(320, 320);
      expect(() => mesh.setWalkable(-1, 0, false)).not.toThrow();
      expect(() => mesh.setWalkable(999, 999, false)).not.toThrow();
    });
  });

  describe('setJumpPoint', () => {
    it('should set a jump point', () => {
      const mesh = new NavigationMesh(320, 320);
      mesh.setJumpPoint(2, 3);
      expect(mesh.getNodeAt(2, 3)?.isJumpPoint).toBe(true);
    });

    it('should not affect walkability', () => {
      const mesh = new NavigationMesh(320, 320);
      mesh.setJumpPoint(2, 3);
      expect(mesh.getNodeAt(2, 3)?.isWalkable).toBe(true);
    });
  });

  describe('getNodeAt', () => {
    it('should return null for out-of-bounds', () => {
      const mesh = new NavigationMesh(320, 320);
      expect(mesh.getNodeAt(-1, 0)).toBeNull();
      expect(mesh.getNodeAt(0, -1)).toBeNull();
      expect(mesh.getNodeAt(999, 0)).toBeNull();
    });

    it('should return node for valid coordinates', () => {
      const mesh = new NavigationMesh(320, 320);
      const node = mesh.getNodeAt(0, 0);
      expect(node).not.toBeNull();
      expect(node?.x).toBeDefined();
      expect(node?.y).toBeDefined();
    });
  });

  describe('getNearestWalkableNode', () => {
    it('should return node at grid position', () => {
      const mesh = new NavigationMesh(320, 320);
      const node = mesh.getNearestWalkableNode(50, 50);
      expect(node).not.toBeNull();
    });
  });

  describe('addPlatformNode', () => {
    it('should add platform nodes', () => {
      const mesh = new NavigationMesh(640, 480);
      mesh.addPlatformNode(100, 200, 300);
      const platforms = mesh.getPlatformNodes();
      expect(platforms).toHaveLength(1);
      expect(platforms[0].x).toBe(100);
      expect(platforms[0].y).toBe(200);
      expect(platforms[0].width).toBe(300);
    });

    it('should calculate jump targets between platforms', () => {
      const mesh = new NavigationMesh(640, 480);
      mesh.addPlatformNode(100, 400, 200);
      mesh.addPlatformNode(200, 200, 200);

      const platforms = mesh.getPlatformNodes();
      expect(platforms[0].jumpTargets.length).toBeGreaterThan(0);
    });

    it('should not add self as jump target', () => {
      const mesh = new NavigationMesh(640, 480);
      mesh.addPlatformNode(100, 400, 200);
      const platforms = mesh.getPlatformNodes();
      expect(platforms[0].jumpTargets).toHaveLength(0);
    });
  });

  describe('addRoomConnection', () => {
    it('should add room connections', () => {
      const mesh = new NavigationMesh(640, 480);
      mesh.addRoomConnection('room1', 'room2', 100, 200);
      const connections = mesh.getRoomConnections();
      expect(connections).toHaveLength(1);
      expect(connections[0].from).toBe('room1');
      expect(connections[0].to).toBe('room2');
    });
  });

  describe('fromTilemap', () => {
    it('should create mesh from tilemap with solid platforms', () => {
      const mesh = NavigationMesh.fromTilemap({
        width: 20,
        height: 15,
        platforms: [
          { x: 0, y: 14, width: 20, height: 1 },
        ],
      });

      expect(mesh).toBeInstanceOf(NavigationMesh);
      expect(mesh.getGridWidth()).toBe(20);
    });

    it('should create mesh with thin platforms (height <= 0.5)', () => {
      const mesh = NavigationMesh.fromTilemap({
        width: 20,
        height: 15,
        platforms: [
          { x: 2, y: 9, width: 4, height: 0.5 },
        ],
      });

      expect(mesh).toBeInstanceOf(NavigationMesh);
      expect(mesh.getPlatformNodes()).toHaveLength(1);
    });

    it('should handle empty platforms array', () => {
      const mesh = NavigationMesh.fromTilemap({
        width: 10,
        height: 10,
        platforms: [],
      });

      expect(mesh).toBeInstanceOf(NavigationMesh);
      expect(mesh.getPlatformNodes()).toHaveLength(0);
    });

    it('should handle mixed platform types', () => {
      const mesh = NavigationMesh.fromTilemap({
        width: 20,
        height: 15,
        platforms: [
          { x: 0, y: 14, width: 20, height: 1 },
          { x: 2, y: 9, width: 4, height: 0.5 },
          { x: 0, y: 0, width: 1, height: 14 },
        ],
      });

      expect(mesh.getPlatformNodes()).toHaveLength(1);
    });
  });
});
