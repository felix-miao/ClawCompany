export type CullingResult = 'visible' | 'culled';
export type LODLevel = 'near' | 'medium' | 'far' | 'minimal';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderOptimizerConfig {
  viewportWidth?: number;
  viewportHeight?: number;
  cullingMargin?: number;
  lodDistances?: {
    near: number;
    medium: number;
    far: number;
  };
}

export interface RenderStats {
  visibleCount: number;
  culledCount: number;
  totalProcessed: number;
}

interface FullConfig {
  viewportWidth: number;
  viewportHeight: number;
  cullingMargin: number;
  lodDistances: {
    near: number;
    medium: number;
    far: number;
  };
}

const DEFAULT_CONFIG: FullConfig = {
  viewportWidth: 800,
  viewportHeight: 600,
  cullingMargin: 64,
  lodDistances: { near: 200, medium: 500, far: 800 },
};

export class RenderOptimizer {
  private config: FullConfig;
  private stats: RenderStats = {
    visibleCount: 0,
    culledCount: 0,
    totalProcessed: 0,
  };
  private objectStates: Map<string, CullingResult> = new Map();
  private lastUpdateFrame: Map<string, number> = new Map();

  constructor(config?: RenderOptimizerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  cull(bounds: BoundingBox, cameraX: number, cameraY: number): CullingResult {
    const margin = this.config.cullingMargin;
    const vpLeft = cameraX - margin;
    const vpRight = cameraX + this.config.viewportWidth + margin;
    const vpTop = cameraY - margin;
    const vpBottom = cameraY + this.config.viewportHeight + margin;

    const isVisible =
      bounds.x + bounds.width >= vpLeft &&
      bounds.x <= vpRight &&
      bounds.y + bounds.height >= vpTop &&
      bounds.y <= vpBottom;

    return isVisible ? 'visible' : 'culled';
  }

  cullBatch(objects: BoundingBox[], cameraX: number, cameraY: number): CullingResult[] {
    return objects.map(obj => {
      const result = this.cull(obj, cameraX, cameraY);
      if (result === 'visible') {
        this.stats.visibleCount++;
      } else {
        this.stats.culledCount++;
      }
      this.stats.totalProcessed++;
      return result;
    });
  }

  getLOD(objectPos: { x: number; y: number }, cameraPos: { x: number; y: number }): LODLevel {
    const dx = objectPos.x - cameraPos.x;
    const dy = objectPos.y - cameraPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const { near, medium, far } = this.config.lodDistances;

    if (dist <= near) return 'near';
    if (dist <= medium) return 'medium';
    if (dist <= far) return 'far';
    return 'minimal';
  }

  shouldUpdate(objectId: string, elapsedSinceLastUpdate: number): boolean {
    const state = this.objectStates.get(objectId);
    if (state === 'culled') return false;
    return elapsedSinceLastUpdate >= 16.67;
  }

  setObjectState(objectId: string, state: CullingResult): void {
    this.objectStates.set(objectId, state);
  }

  getStats(): RenderStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { visibleCount: 0, culledCount: 0, totalProcessed: 0 };
  }

  setViewport(width: number, height: number): void {
    this.config.viewportWidth = width;
    this.config.viewportHeight = height;
  }
}
