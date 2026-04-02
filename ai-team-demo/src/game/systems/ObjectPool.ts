export interface Poolable {
  active: boolean;
  reset(): void;
}

export interface ObjectPoolConfig<T extends Poolable> {
  create: () => T;
  reset: (obj: T) => void;
  initialSize: number;
  maxSize?: number;
}

export interface PoolStats {
  acquireCount: number;
  releaseCount: number;
  createdCount: number;
  peakInUse: number;
  currentInUse: number;
}

export class ObjectPool<T extends Poolable> {
  private readonly createFn: () => T;
  private readonly resetFn: (obj: T) => void;
  readonly maxSize: number;
  private pool: T[] = [];
  private activeCount = 0;
  private stats: PoolStats = {
    acquireCount: 0,
    releaseCount: 0,
    createdCount: 0,
    peakInUse: 0,
    currentInUse: 0,
  };

  constructor(config: ObjectPoolConfig<T>) {
    this.createFn = config.create;
    this.resetFn = config.reset;
    this.maxSize = config.maxSize ?? Infinity;

    for (let i = 0; i < config.initialSize && this.pool.length < this.maxSize; i++) {
      const obj = this.createObject();
      this.pool.push(obj);
    }
  }

  acquire(): T | null {
    if (this.pool.length > 0) {
      const obj = this.pool.pop()!;
      obj.active = true;
      this.resetFn(obj);
      this.activeCount++;
      this.stats.acquireCount++;
      this.stats.currentInUse = this.activeCount;
      if (this.activeCount > this.stats.peakInUse) {
        this.stats.peakInUse = this.activeCount;
      }
      return obj;
    }

    if (this.stats.createdCount >= this.maxSize) {
      return null;
    }

    const obj = this.createObject();
    obj.active = true;
    this.activeCount++;
    this.stats.acquireCount++;
    this.stats.currentInUse = this.activeCount;
    if (this.activeCount > this.stats.peakInUse) {
      this.stats.peakInUse = this.activeCount;
    }
    return obj;
  }

  release(obj: T): void {
    obj.active = false;
    this.resetFn(obj);
    this.activeCount--;
    this.stats.releaseCount++;
    this.stats.currentInUse = this.activeCount;

    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  available(): number {
    return this.pool.length;
  }

  totalSize(): number {
    return this.stats.createdCount;
  }

  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      const obj = this.createObject();
      this.pool.push(obj);
    }
  }

  shrink(keepCount: number): void {
    const toRemove = Math.max(0, this.pool.length - keepCount);
    this.pool.splice(0, toRemove);
  }

  drain(): void {
    this.pool = [];
  }

  getStats(): PoolStats {
    return { ...this.stats };
  }

  acquireMultiple(count: number): T[] {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
      const obj = this.acquire();
      if (!obj) break;
      results.push(obj);
    }
    return results;
  }

  releaseMultiple(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  private createObject(): T {
    this.stats.createdCount++;
    return this.createFn();
  }
}
