export interface RoleVisualConfig {
  hatType: 'none' | 'cap' | 'formal' | 'headband';
  accentColor: number;
  hasTie: boolean;
  hasGlasses: boolean;
  hasBadge: boolean;
  eyeStyle: 'round' | 'narrow' | 'wide';
  accessoryColor: number;
}

export interface NameBadgeConfig {
  fontSize: number;
  bgColor: number;
  textColor: string;
  borderColor: number;
  padding: number;
}

const ROLE_CONFIGS: Record<string, RoleVisualConfig> = {
  Developer: {
    hatType: 'cap',
    accentColor: 0x3b82f6,
    hasTie: false,
    hasGlasses: false,
    hasBadge: false,
    eyeStyle: 'round',
    accessoryColor: 0x1e40af,
  },
  'Project Manager': {
    hatType: 'formal',
    accentColor: 0xf59e0b,
    hasTie: true,
    hasGlasses: false,
    hasBadge: false,
    eyeStyle: 'narrow',
    accessoryColor: 0xd97706,
  },
  'Code Reviewer': {
    hatType: 'none',
    accentColor: 0x8b5cf6,
    hasTie: false,
    hasGlasses: true,
    hasBadge: false,
    eyeStyle: 'narrow',
    accessoryColor: 0x6d28d9,
  },
  Tester: {
    hatType: 'headband',
    accentColor: 0x10b981,
    hasTie: false,
    hasGlasses: false,
    hasBadge: true,
    eyeStyle: 'wide',
    accessoryColor: 0x059669,
  },
};

const DEFAULT_CONFIG: RoleVisualConfig = {
  hatType: 'none',
  accentColor: 0x888888,
  hasTie: false,
  hasGlasses: false,
  hasBadge: false,
  eyeStyle: 'round',
  accessoryColor: 0x555555,
};

const BADGE_CONFIGS: Record<string, NameBadgeConfig> = {
  Developer: { fontSize: 9, bgColor: 0x3b82f6, textColor: '#ffffff', borderColor: 0x1e40af, padding: 3 },
  'Project Manager': { fontSize: 9, bgColor: 0xf59e0b, textColor: '#000000', borderColor: 0xd97706, padding: 3 },
  'Code Reviewer': { fontSize: 9, bgColor: 0x8b5cf6, textColor: '#ffffff', borderColor: 0x6d28d9, padding: 3 },
  Tester: { fontSize: 9, bgColor: 0x10b981, textColor: '#ffffff', borderColor: 0x059669, padding: 3 },
};

const DEFAULT_BADGE_CONFIG: NameBadgeConfig = {
  fontSize: 9,
  bgColor: 0x666666,
  textColor: '#ffffff',
  borderColor: 0x444444,
  padding: 3,
};

export class RoleVisuals {
  getAvailableRoles(): string[] {
    return Object.keys(ROLE_CONFIGS);
  }

  getRoleConfig(role: string): RoleVisualConfig {
    return ROLE_CONFIGS[role] ?? { ...DEFAULT_CONFIG };
  }

  getNameBadgeConfig(role: string): NameBadgeConfig {
    return BADGE_CONFIGS[role] ?? { ...DEFAULT_BADGE_CONFIG };
  }

  getAllConfigs(): Record<string, RoleVisualConfig> {
    return { ...ROLE_CONFIGS };
  }
}
