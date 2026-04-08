export interface TrackedResource {
  type: string;
  id: string;
  estimatedSize: number;
  createdAt?: number;
  destroy?: () => void;
}

interface InternalResource extends TrackedResource {
  createdAt: number;
  age: number;
}

export interface MemorySnapshot {
  totalBytes: number;
  resourceCount: number;
  byType: Map<string, number>;
  timestamp: number;
}

export interface MemoryManagerConfig {
  maxTrackedResources?: number;
  cleanupInterval?: number;
  warningThresholdMB?: number;
  memoryBudgetMB?: number;
}

export class MemoryManager {
  private resources: Map<string, InternalResource> = new Map();
  private readonly maxResources: number;
  private readonly memoryBudgetBytes: number;

  constructor(config?: MemoryManagerConfig) {
    this.maxResources = config?.maxTrackedResources ?? Infinity;
    this.memoryBudgetBytes = (config?.memoryBudgetMB ?? Infinity) * 1024 * 1024;
  }

  track(resource: TrackedResource): void {
    if (this.resources.has(resource.id)) return;
    if (this.resources.size >= this.maxResources) return;

    const internal: InternalResource = {
      type: resource.type,
      id: resource.id,
      estimatedSize: resource.estimatedSize,
      createdAt: resource.createdAt ?? Date.now(),
      age: 0,
      destroy: resource.destroy,
    };
    this.resources.set(resource.id, internal);
  }

  untrack(id: string): void {
    this.resources.delete(id);
  }

  getTrackedCount(): number {
    return this.resources.size;
  }

  getEstimatedMemoryUsage(): number {
    let total = 0;
    this.resources.forEach(r => { total += r.estimatedSize; });
    return total;
  }

  getMemoryByType(): Map<string, number> {
    const byType = new Map<string, number>();
    this.resources.forEach(r => {
      const current = byType.get(r.type) ?? 0;
      byType.set(r.type, current + r.estimatedSize);
    });
    return byType;
  }

  getResources(): InternalResource[] {
    const now = Date.now();
    return Array.from(this.resources.values()).map(r => ({
      ...r,
      age: now - r.createdAt,
    }));
  }

  getStaleResources(maxAgeMs: number): InternalResource[] {
    const now = Date.now();
    return Array.from(this.resources.values()).filter(
      r => now - r.createdAt >= maxAgeMs
    );
  }

  cleanupStale(maxAgeMs: number): number {
    const stale = this.getStaleResources(maxAgeMs);
    for (const r of stale) {
      r.destroy?.();
      this.resources.delete(r.id);
    }
    return stale.length;
  }

  cleanupByType(type: string): number {
    let count = 0;
    const ids: string[] = [];
    this.resources.forEach((r, id) => {
      if (r.type === type) {
        r.destroy?.();
        ids.push(id);
        count++;
      }
    });
    ids.forEach(id => this.resources.delete(id));
    return count;
  }

  cleanupAll(): void {
    this.resources.forEach(r => { r.destroy?.(); });
    this.resources.clear();
  }

  takeSnapshot(): MemorySnapshot {
    return {
      totalBytes: this.getEstimatedMemoryUsage(),
      resourceCount: this.resources.size,
      byType: this.getMemoryByType(),
      timestamp: Date.now(),
    };
  }

  isOverBudget(): boolean {
    return this.getEstimatedMemoryUsage() > this.memoryBudgetBytes;
  }

  getBudgetUsedPercent(): number {
    if (this.memoryBudgetBytes <= 0) return 0;
    return Math.min(100, (this.getEstimatedMemoryUsage() / this.memoryBudgetBytes) * 100);
  }
}
