import { PathfindingSystem } from '../PathfindingSystem';
import { NavigationMesh } from '../../data/NavigationMesh';
import { TILE_SIZE } from '../../config/gameConfig';

jest.mock('phaser', () => ({}));

function createMockScene() {
  const graphics = {
    clear: jest.fn(),
    setVisible: jest.fn(),
    lineStyle: jest.fn(),
    lineBetween: jest.fn(),
    fillStyle: jest.fn(),
    fillCircle: jest.fn(),
    destroy: jest.fn(),
  };
  return {
    add: {
      graphics: jest.fn(() => graphics),
    },
    _graphics: graphics,
  } as any;
}

function createNavMeshWithPlatforms(
  platforms: { x: number; y: number; width: number }[]
): NavigationMesh {
  const mesh = new NavigationMesh(800, 600);
  for (const p of platforms) {
    mesh.addPlatformNode(p.x * TILE_SIZE, p.y * TILE_SIZE, p.width * TILE_SIZE);
  }
  return mesh;
}

describe('PathfindingSystem', () => {
  let mockScene: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    mockScene = createMockScene();
  });

  describe('findPath - same platform', () => {
    it('should return direct move when start and end are on the same platform', () => {
      const mesh = createNavMeshWithPlatforms([{ x: 2, y: 5, width: 6 }]);
      const system = new PathfindingSystem(mockScene, mesh);

      const startX = 2 * TILE_SIZE + TILE_SIZE / 2;
      const startY = 5 * TILE_SIZE + TILE_SIZE / 2;
      const endX = 6 * TILE_SIZE + TILE_SIZE / 2;
      const endY = 5 * TILE_SIZE + TILE_SIZE / 2;

      const path = system.findPath(startX, startY, endX, endY);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1].x).toBe(endX);
      expect(path[path.length - 1].y).toBe(endY);
    });
  });

  describe('findPath - jump targets', () => {
    it('should find path to platform reachable by jump', () => {
      const mesh = createNavMeshWithPlatforms([
        { x: 2, y: 8, width: 4 },
        { x: 5, y: 6, width: 4 },
      ]);
      const system = new PathfindingSystem(mockScene, mesh);

      const startX = 3 * TILE_SIZE;
      const startY = 8 * TILE_SIZE;
      const endX = 6 * TILE_SIZE;
      const endY = 6 * TILE_SIZE;

      const path = system.findPath(startX, startY, endX, endY);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1].x).toBe(endX);
      expect(path[path.length - 1].y).toBe(endY);
    });
  });

  describe('findPath - adjacent same-level platforms', () => {
    it('should find path between adjacent platforms on the same y level using platform path', () => {
      const mesh = createNavMeshWithPlatforms([
        { x: 2, y: 5, width: 4 },
        { x: 5, y: 5, width: 3 },
      ]);
      const system = new PathfindingSystem(mockScene, mesh);

      const startX = 2 * TILE_SIZE + TILE_SIZE / 2;
      const startY = 5 * TILE_SIZE + TILE_SIZE / 2;
      const endX = 6 * TILE_SIZE + TILE_SIZE / 2;
      const endY = 5 * TILE_SIZE + TILE_SIZE / 2;

      const path = system.findPath(startX, startY, endX, endY);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1].x).toBe(endX);
      expect(path[path.length - 1].y).toBe(endY);

      const hasJump = path.some(p => p.action === 'jump');
      expect(hasJump).toBe(false);
    });
  });

  describe('findPath - pixel distance adjacency regression', () => {
    it('should connect platforms within pixel distance of platform width', () => {
      const mesh = createNavMeshWithPlatforms([
        { x: 0, y: 5, width: 5 },
        { x: 4, y: 5, width: 3 },
      ]);
      const system = new PathfindingSystem(mockScene, mesh);

      const startX = 1 * TILE_SIZE;
      const startY = 5 * TILE_SIZE;
      const endX = 5 * TILE_SIZE;
      const endY = 5 * TILE_SIZE;

      const path = system.findPath(startX, startY, endX, endY);
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe('getCurrentPath', () => {
    it('should return the last computed path', () => {
      const mesh = createNavMeshWithPlatforms([{ x: 2, y: 5, width: 6 }]);
      const system = new PathfindingSystem(mockScene, mesh);

      system.findPath(
        2 * TILE_SIZE + TILE_SIZE / 2,
        5 * TILE_SIZE + TILE_SIZE / 2,
        6 * TILE_SIZE + TILE_SIZE / 2,
        5 * TILE_SIZE + TILE_SIZE / 2
      );

      expect(system.getCurrentPath().length).toBeGreaterThan(0);
    });
  });

  describe('drawDebug', () => {
    it('should create graphics on first call', () => {
      const mesh = createNavMeshWithPlatforms([{ x: 2, y: 5, width: 6 }]);
      const system = new PathfindingSystem(mockScene, mesh);
      system.findPath(
        2 * TILE_SIZE + TILE_SIZE / 2,
        5 * TILE_SIZE + TILE_SIZE / 2,
        6 * TILE_SIZE + TILE_SIZE / 2,
        5 * TILE_SIZE + TILE_SIZE / 2
      );
      system.drawDebug(true);
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should set visible false when hidden', () => {
      const mesh = createNavMeshWithPlatforms([{ x: 2, y: 5, width: 6 }]);
      const system = new PathfindingSystem(mockScene, mesh);
      system.drawDebug(false);
      expect(mockScene._graphics.setVisible).toHaveBeenCalledWith(false);
    });
  });

  describe('performance', () => {
    it('should handle many platform nodes efficiently', () => {
      const platforms: { x: number; y: number; width: number }[] = [];
      for (let i = 0; i < 50; i++) {
        platforms.push({ x: i * 2, y: 5 + (i % 3), width: 3 });
      }
      const mesh = createNavMeshWithPlatforms(platforms);
      const system = new PathfindingSystem(mockScene, mesh);

      const start = performance.now();
      system.findPath(2 * TILE_SIZE, 5 * TILE_SIZE, 98 * TILE_SIZE, 5 * TILE_SIZE);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });
  });
});
