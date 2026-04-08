export interface ShadowConfig {
  opacity: number;
  offsetY: number;
  scaleY: number;
}

const DEFAULT_CONFIG: ShadowConfig = {
  opacity: 0.3,
  offsetY: 4,
  scaleY: 0.3,
};

export class ShadowRenderer {
  private config: ShadowConfig;

  constructor(config?: Partial<ShadowConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.config.opacity = Math.max(0, Math.min(1, this.config.opacity));
  }

  getConfig(): ShadowConfig {
    return { ...this.config };
  }

  getShadowDimensions(charWidth: number, _charHeight: number): { width: number; height: number; offsetY: number } {
    const width = Math.max(8, charWidth);
    const height = Math.max(3, Math.round(charWidth * this.config.scaleY));
    return { width, height, offsetY: this.config.offsetY };
  }

  getShadowColor(): { color: number; alpha: number } {
    return { color: 0x000000, alpha: this.config.opacity };
  }

  calculateShadowOpacity(heightAboveGround: number): number {
    const fadeRate = 0.003;
    return Math.max(0, this.config.opacity - heightAboveGround * fadeRate);
  }

  updateConfig(partial: Partial<ShadowConfig>): void {
    if (partial.opacity !== undefined) {
      this.config.opacity = Math.max(0, Math.min(1, partial.opacity));
    }
    if (partial.offsetY !== undefined) {
      this.config.offsetY = partial.offsetY;
    }
    if (partial.scaleY !== undefined) {
      this.config.scaleY = partial.scaleY;
    }
  }
}
