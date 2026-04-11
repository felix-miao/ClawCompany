import { OfficeMapGenerator, OfficeRoom, OfficeDecoration } from '../OfficeMapGenerator';

jest.mock('phaser', () => {
  const mockGraphics = {
    clear: jest.fn(),
    fillStyle: jest.fn().mockReturnThis(),
    fillRect: jest.fn().mockReturnThis(),
    fillRoundedRect: jest.fn().mockReturnThis(),
    lineStyle: jest.fn().mockReturnThis(),
    strokeRect: jest.fn().mockReturnThis(),
    fillCircle: jest.fn().mockReturnThis(),
    arc: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    generateTexture: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };

  const mockImage = {
    setOrigin: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
  };

  const mockScene = {
    add: {
      graphics: jest.fn(() => ({ ...mockGraphics })),
      image: jest.fn(() => ({ ...mockImage })),
      text: jest.fn(() => ({ setOrigin: jest.fn().mockReturnThis(), setDepth: jest.fn().mockReturnThis(), destroy: jest.fn() })),
    },
    anims: {
      create: jest.fn(),
    },
    cameras: {
      main: {
        width: 800,
        height: 600,
      },
    },
  };

  return {
    default: {
      GameObjects: { Graphics: jest.fn(), Image: jest.fn() },
    },
    __mocks: { mockScene, mockGraphics, mockImage },
  };
});

const Phaser = require('phaser');
const { mockScene, mockGraphics } = Phaser.__mocks;

describe('OfficeMapGenerator', () => {
  let generator: OfficeMapGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new OfficeMapGenerator(mockScene as any);
  });

  describe('constructor', () => {
    it('should create OfficeMapGenerator', () => {
      expect(generator).toBeDefined();
    });
  });

  describe('generateOffice', () => {
    it('should return platforms, decorations, rooms, and workstations', async () => {
      const result = await generator.generateOffice();
      
      expect(result).toHaveProperty('platforms');
      expect(result).toHaveProperty('decorations');
      expect(result).toHaveProperty('rooms');
      expect(result).toHaveProperty('workstations');
    });

    it('should return non-empty arrays', async () => {
      const result = await generator.generateOffice();
      
      expect(result.platforms.length).toBeGreaterThan(0);
      expect(result.decorations.length).toBeGreaterThan(0);
      expect(result.rooms.length).toBeGreaterThan(0);
      expect(result.workstations.length).toBeGreaterThan(0);
    });
  });

  describe('platforms', () => {
    it('should include outer walls', async () => {
      const result = await generator.generateOffice();
      
      const outerWalls = result.platforms.filter(p => p.type === 'wall_outer');
      expect(outerWalls.length).toBeGreaterThan(0);
    });

    it('should include inner walls', async () => {
      const result = await generator.generateOffice();
      
      const innerWalls = result.platforms.filter(p => p.type === 'wall_inner');
      expect(innerWalls.length).toBeGreaterThan(0);
    });

    it('should include desks', async () => {
      const result = await generator.generateOffice();
      
      const desks = result.platforms.filter(p => p.type === 'desk');
      expect(desks.length).toBeGreaterThan(0);
    });

    it('should include chairs', async () => {
      const result = await generator.generateOffice();
      
      const chairs = result.platforms.filter(p => p.type === 'chair');
      expect(chairs.length).toBeGreaterThan(0);
    });

    it('should have valid platform properties', async () => {
      const result = await generator.generateOffice();
      
      result.platforms.forEach(platform => {
        expect(typeof platform.x).toBe('number');
        expect(typeof platform.y).toBe('number');
        expect(typeof platform.width).toBe('number');
        expect(typeof platform.height).toBe('number');
        expect(typeof platform.type).toBe('string');
      });
    });
  });

  describe('decorations', () => {
    it('should include plants', async () => {
      const result = await generator.generateOffice();
      
      const plants = result.decorations.filter(d => d.type === 'plant');
      expect(plants.length).toBeGreaterThan(0);
    });

    it('should include windows', async () => {
      const result = await generator.generateOffice();
      
      const windows = result.decorations.filter(d => d.type === 'window');
      expect(windows.length).toBeGreaterThan(0);
    });

    it('should include computers', async () => {
      const result = await generator.generateOffice();
      
      const computers = result.decorations.filter(d => d.type === 'computer');
      expect(computers.length).toBeGreaterThan(0);
    });

    it('should include art', async () => {
      const result = await generator.generateOffice();
      
      const art = result.decorations.filter(d => d.type === 'art');
      expect(art.length).toBeGreaterThan(0);
    });

    it('should include bookshelves', async () => {
      const result = await generator.generateOffice();
      
      const bookshelves = result.decorations.filter(d => d.type === 'bookshelf');
      expect(bookshelves.length).toBeGreaterThan(0);
    });

    it('should have valid decoration properties', async () => {
      const result = await generator.generateOffice();
      
      result.decorations.forEach(decoration => {
        expect(typeof decoration.id).toBe('string');
        expect(typeof decoration.type).toBe('string');
        expect(typeof decoration.x).toBe('number');
        expect(typeof decoration.y).toBe('number');
        expect(typeof decoration.width).toBe('number');
        expect(typeof decoration.height).toBe('number');
      });
    });
  });

  describe('rooms', () => {
    it('should have meeting room', async () => {
      const result = await generator.generateOffice();
      
      const meetingRoom = result.rooms.find(r => r.type === 'meeting');
      expect(meetingRoom).toBeDefined();
    });

    it('should have development room', async () => {
      const result = await generator.generateOffice();
      
      const devRoom = result.rooms.find(r => r.type === 'development');
      expect(devRoom).toBeDefined();
    });

    it('should have testing room', async () => {
      const result = await generator.generateOffice();
      
      const testRoom = result.rooms.find(r => r.type === 'testing');
      expect(testRoom).toBeDefined();
    });

    it('should have review room', async () => {
      const result = await generator.generateOffice();
      
      const reviewRoom = result.rooms.find(r => r.type === 'review');
      expect(reviewRoom).toBeDefined();
    });

    it('should have valid room properties', async () => {
      const result = await generator.generateOffice();
      
      result.rooms.forEach(room => {
        expect(typeof room.id).toBe('string');
        expect(typeof room.name).toBe('string');
        expect(typeof room.x).toBe('number');
        expect(typeof room.y).toBe('number');
        expect(typeof room.width).toBe('number');
        expect(typeof room.height).toBe('number');
        expect(typeof room.type).toBe('string');
      });
    });

    it('should have decorations in rooms', async () => {
      const result = await generator.generateOffice();
      
      const roomWithDecoration = result.rooms.find(r => r.decoration && r.decoration.length > 0);
      expect(roomWithDecoration).toBeDefined();
    });
  });

  describe('workstations', () => {
    it('should have multiple workstations', async () => {
      const result = await generator.generateOffice();
      
      expect(result.workstations.length).toBeGreaterThanOrEqual(5);
    });

    it('should have valid workstation properties', async () => {
      const result = await generator.generateOffice();
      
      result.workstations.forEach(ws => {
        expect(typeof ws.id).toBe('string');
        expect(typeof ws.x).toBe('number');
        expect(typeof ws.y).toBe('number');
        expect(typeof ws.label).toBe('string');
        expect(typeof ws.status).toBe('string');
        expect(typeof ws.taskType).toBe('string');
      });
    });

    it('should have idle or busy status', async () => {
      const result = await generator.generateOffice();
      
      result.workstations.forEach(ws => {
        expect(['idle', 'busy']).toContain(ws.status);
      });
    });

    it('should have valid task types', async () => {
      const result = await generator.generateOffice();
      
      const validTypes = ['coding', 'testing', 'review', 'meeting'];
      result.workstations.forEach(ws => {
        expect(validTypes).toContain(ws.taskType);
      });
    });
  });

  describe('getDecorationAsset', () => {
    it('should return plant asset', () => {
      const asset = generator.getDecorationAsset('plant');
      expect(asset).toBeDefined();
    });

    it('should return computer asset', () => {
      const asset = generator.getDecorationAsset('computer');
      expect(asset).toBeDefined();
    });

    it('should return window asset', () => {
      const asset = generator.getDecorationAsset('window');
      expect(asset).toBeDefined();
    });

    it('should return door asset', () => {
      const asset = generator.getDecorationAsset('door');
      expect(asset).toBeDefined();
    });

    it('should return art-frame for art type', () => {
      const asset = generator.getDecorationAsset('art');
      expect(asset).toBe('art-frame');
    });

    it('should return floor as default', () => {
      const asset = generator.getDecorationAsset('unknown');
      expect(asset).toBe('floor');
    });
  });

  describe('decoration asset texture existence', () => {
    const decorationTypes = ['plant', 'computer', 'window', 'door', 'art', 'bookshelf'] as const;

    decorationTypes.forEach(decoType => {
      it(`should return a valid asset key for "${decoType}"`, async () => {
        await generator.generateOffice();
        const asset = generator.getDecorationAsset(decoType);
        expect(asset).toBeDefined();
        expect(typeof asset).toBe('string');
        expect(asset.length).toBeGreaterThan(0);
      });
    });

    it('should have art-frame texture generated after loadResources', async () => {
      await generator.generateOffice();
      const artAsset = generator.getDecorationAsset('art');
      expect(artAsset).toBe('art-frame');
      const generatedKeys = mockGraphics.generateTexture.mock.calls.map(
        (call: any[]) => call[0]
      );
      expect(generatedKeys).toContain('art-frame');
    });
  });

  describe('renderDecorations', () => {
    it('should not throw when rendering empty array', () => {
      expect(() => {
        generator.renderDecorations([]);
      }).not.toThrow();
    });

    it('should not throw when rendering decorations', () => {
      const decorations: OfficeDecoration[] = [
        { id: 'test1', type: 'plant', x: 1, y: 1, width: 1, height: 1 },
      ];
      
      expect(() => {
        generator.renderDecorations(decorations);
      }).not.toThrow();
    });
  });

  describe('createOfficeBackground', () => {
    it('should create background without errors', () => {
      expect(() => {
        generator.createOfficeBackground();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple generateOffice calls', async () => {
      const result1 = await generator.generateOffice();
      const result2 = await generator.generateOffice();
      
      expect(result1.platforms.length).toBe(result2.platforms.length);
    });

    it('should generate consistent rooms', async () => {
      const result1 = await generator.generateOffice();
      const result2 = await generator.generateOffice();
      
      expect(result1.rooms.length).toBe(result2.rooms.length);
    });
  });
});