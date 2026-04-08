import { ShadowRenderer } from '../ShadowRenderer';

describe('ShadowRenderer', () => {
  let renderer: ShadowRenderer;

  beforeEach(() => {
    renderer = new ShadowRenderer();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const config = renderer.getConfig();
      expect(config.opacity).toBe(0.3);
      expect(config.offsetY).toBe(4);
      expect(config.scaleY).toBe(0.3);
    });

    it('should accept custom config', () => {
      const custom = new ShadowRenderer({ opacity: 0.5, offsetY: 8, scaleY: 0.4 });
      const config = custom.getConfig();
      expect(config.opacity).toBe(0.5);
      expect(config.offsetY).toBe(8);
      expect(config.scaleY).toBe(0.4);
    });
  });

  describe('getShadowDimensions', () => {
    it('should return shadow dimensions for a character', () => {
      const dims = renderer.getShadowDimensions(32, 32);
      expect(dims.width).toBe(32);
      expect(dims.height).toBe(Math.round(32 * 0.3));
      expect(dims.offsetY).toBe(4);
    });

    it('should scale shadow with character size', () => {
      const small = renderer.getShadowDimensions(16, 16);
      const large = renderer.getShadowDimensions(64, 64);
      expect(large.width).toBeGreaterThan(small.width);
    });

    it('should clamp minimum shadow size', () => {
      const dims = renderer.getShadowDimensions(4, 4);
      expect(dims.width).toBeGreaterThanOrEqual(8);
      expect(dims.height).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getShadowColor', () => {
    it('should return semi-transparent black', () => {
      const color = renderer.getShadowColor();
      expect(color.color).toBe(0x000000);
      expect(color.alpha).toBe(0.3);
    });

    it('should respect config opacity', () => {
      const custom = new ShadowRenderer({ opacity: 0.5 });
      const color = custom.getShadowColor();
      expect(color.alpha).toBe(0.5);
    });
  });

  describe('calculateShadowOpacity', () => {
    it('should reduce opacity when character is higher', () => {
      const groundLevel = renderer.calculateShadowOpacity(0);
      const highUp = renderer.calculateShadowOpacity(100);
      expect(highUp).toBeLessThan(groundLevel);
    });

    it('should return base opacity at ground level', () => {
      const opacity = renderer.calculateShadowOpacity(0);
      expect(opacity).toBe(0.3);
    });

    it('should clamp opacity to 0 minimum', () => {
      const opacity = renderer.calculateShadowOpacity(1000);
      expect(opacity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateConfig', () => {
    it('should update partial config', () => {
      renderer.updateConfig({ opacity: 0.6 });
      const config = renderer.getConfig();
      expect(config.opacity).toBe(0.6);
      expect(config.offsetY).toBe(4);
    });

    it('should clamp opacity to valid range', () => {
      renderer.updateConfig({ opacity: -0.5 });
      expect(renderer.getConfig().opacity).toBe(0);
      renderer.updateConfig({ opacity: 1.5 });
      expect(renderer.getConfig().opacity).toBe(1);
    });
  });
});
