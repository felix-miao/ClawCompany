import { RoleVisuals } from '../RoleVisuals';

describe('RoleVisuals', () => {
  let roleVisuals: RoleVisuals;

  beforeEach(() => {
    roleVisuals = new RoleVisuals();
  });

  describe('constructor', () => {
    it('should initialize with role configs', () => {
      const roles = roleVisuals.getAvailableRoles();
      expect(roles).toContain('Developer');
      expect(roles).toContain('Project Manager');
      expect(roles).toContain('Code Reviewer');
      expect(roles).toContain('Tester');
    });
  });

  describe('getRoleConfig', () => {
    it('should return config for Developer', () => {
      const config = roleVisuals.getRoleConfig('Developer');
      expect(config).toBeDefined();
      expect(config.hatType).toBeDefined();
      expect(config.accentColor).toBeDefined();
    });

    it('should return config for Project Manager', () => {
      const config = roleVisuals.getRoleConfig('Project Manager');
      expect(config).toBeDefined();
      expect(config.hatType).not.toBe('none');
    });

    it('should return config for Code Reviewer', () => {
      const config = roleVisuals.getRoleConfig('Code Reviewer');
      expect(config).toBeDefined();
    });

    it('should return default config for unknown role', () => {
      const config = roleVisuals.getRoleConfig('Unknown');
      expect(config).toBeDefined();
      expect(config.hatType).toBe('none');
    });
  });

  describe('role accessories', () => {
    it('should give Developers a cap', () => {
      const config = roleVisuals.getRoleConfig('Developer');
      expect(config.hatType).toBe('cap');
    });

    it('should give PM a tie', () => {
      const config = roleVisuals.getRoleConfig('Project Manager');
      expect(config.hatType).toBe('formal');
      expect(config.hasTie).toBe(true);
    });

    it('should give Reviewer glasses', () => {
      const config = roleVisuals.getRoleConfig('Code Reviewer');
      expect(config.hasGlasses).toBe(true);
    });

    it('should give Tester a badge', () => {
      const config = roleVisuals.getRoleConfig('Tester');
      expect(config.hasBadge).toBe(true);
    });
  });

  describe('accent colors', () => {
    it('should have distinct accent colors per role', () => {
      const devColor = roleVisuals.getRoleConfig('Developer').accentColor;
      const pmColor = roleVisuals.getRoleConfig('Project Manager').accentColor;
      const revColor = roleVisuals.getRoleConfig('Code Reviewer').accentColor;
      const testColor = roleVisuals.getRoleConfig('Tester').accentColor;

      const colors = [devColor, pmColor, revColor, testColor];
      const unique = new Set(colors);
      expect(unique.size).toBe(4);
    });
  });

  describe('getNameBadgeConfig', () => {
    it('should return badge config for a role', () => {
      const config = roleVisuals.getNameBadgeConfig('Developer');
      expect(config).toBeDefined();
      expect(config.fontSize).toBeGreaterThan(0);
      expect(config.bgColor).toBeDefined();
      expect(config.textColor).toBeDefined();
    });

    it('should return default for unknown role', () => {
      const config = roleVisuals.getNameBadgeConfig('Unknown');
      expect(config).toBeDefined();
      expect(config.fontSize).toBeGreaterThan(0);
    });
  });

  describe('getAllConfigs', () => {
    it('should return configs for all roles', () => {
      const configs = roleVisuals.getAllConfigs();
      expect(Object.keys(configs).length).toBeGreaterThanOrEqual(4);
    });
  });
});
