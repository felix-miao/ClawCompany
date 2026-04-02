import { ObjectPool, Poolable } from '../ObjectPool';

interface TestObject extends Poolable {
  value: number;
  reset(): void;
}

function createTestObject(value: number): TestObject {
  return {
    active: false,
    value,
    reset() {
      this.value = 0;
    },
  };
}

describe('ObjectPool', () => {
  let pool: ObjectPool<TestObject>;

  beforeEach(() => {
    pool = new ObjectPool({
      create: () => createTestObject(0),
      reset: (obj) => obj.reset(),
      initialSize: 5,
    });
  });

  describe('constructor', () => {
    it('should pre-allocate objects up to initialSize', () => {
      expect(pool.available()).toBe(5);
      expect(pool.totalSize()).toBe(5);
    });

    it('should work with initialSize 0', () => {
      const emptyPool = new ObjectPool({
        create: () => createTestObject(0),
        reset: (obj) => obj.reset(),
        initialSize: 0,
      });
      expect(emptyPool.available()).toBe(0);
      expect(emptyPool.totalSize()).toBe(0);
    });

    it('should respect maxSize limit', () => {
      const limitedPool = new ObjectPool({
        create: () => createTestObject(0),
        reset: (obj) => obj.reset(),
        initialSize: 3,
        maxSize: 5,
      });
      expect(limitedPool.available()).toBe(3);
      expect(limitedPool.maxSize).toBe(5);
    });
  });

  describe('acquire', () => {
    it('should return an object from the pool', () => {
      const obj = pool.acquire();
      expect(obj).toBeDefined();
      expect(obj.active).toBe(true);
    });

    it('should reduce available count', () => {
      pool.acquire();
      expect(pool.available()).toBe(4);
    });

    it('should create new object when pool is empty', () => {
      for (let i = 0; i < 5; i++) pool.acquire();
      expect(pool.available()).toBe(0);

      const obj = pool.acquire();
      expect(obj).toBeDefined();
      expect(obj.active).toBe(true);
      expect(pool.totalSize()).toBe(6);
    });

    it('should reset object state when acquiring', () => {
      const obj = pool.acquire();
      obj.value = 42;
      pool.release(obj);

      const reacquired = pool.acquire();
      expect(reacquired.value).toBe(0);
    });

    it('should return null when pool is at max capacity and empty', () => {
      const limitedPool = new ObjectPool({
        create: () => createTestObject(0),
        reset: (obj) => obj.reset(),
        initialSize: 0,
        maxSize: 2,
      });

      limitedPool.acquire();
      limitedPool.acquire();
      const result = limitedPool.acquire();
      expect(result).toBeNull();
    });
  });

  describe('release', () => {
    it('should return object to pool', () => {
      const obj = pool.acquire();
      pool.release(obj);
      expect(pool.available()).toBe(5);
    });

    it('should mark object as inactive', () => {
      const obj = pool.acquire();
      pool.release(obj);
      expect(obj.active).toBe(false);
    });

    it('should reset object on release', () => {
      const obj = pool.acquire();
      obj.value = 99;
      pool.release(obj);
      expect(obj.value).toBe(0);
    });

    it('should not exceed maxSize on release', () => {
      const limitedPool = new ObjectPool({
        create: () => createTestObject(0),
        reset: (obj) => obj.reset(),
        initialSize: 0,
        maxSize: 2,
      });

      const obj1 = limitedPool.acquire();
      const obj2 = limitedPool.acquire();
      const obj3 = { active: true, value: 0, reset() { this.value = 0; } };

      limitedPool.release(obj1);
      limitedPool.release(obj2);
      limitedPool.release(obj3);

      expect(limitedPool.available()).toBe(2);
    });
  });

  describe('prewarm', () => {
    it('should add more objects to the pool', () => {
      pool.prewarm(5);
      expect(pool.available()).toBe(10);
      expect(pool.totalSize()).toBe(10);
    });

    it('should not exceed maxSize', () => {
      const limitedPool = new ObjectPool({
        create: () => createTestObject(0),
        reset: (obj) => obj.reset(),
        initialSize: 2,
        maxSize: 5,
      });
      limitedPool.prewarm(10);
      expect(limitedPool.available()).toBe(5);
    });
  });

  describe('shrink', () => {
    it('should remove excess objects from pool', () => {
      pool.shrink(3);
      expect(pool.available()).toBe(3);
    });

    it('should handle shrinking to 0', () => {
      pool.shrink(0);
      expect(pool.available()).toBe(0);
    });
  });

  describe('drain', () => {
    it('should remove all pooled objects', () => {
      pool.drain();
      expect(pool.available()).toBe(0);
    });
  });

  describe('stats', () => {
    it('should track acquire count', () => {
      pool.acquire();
      pool.acquire();
      expect(pool.getStats().acquireCount).toBe(2);
    });

    it('should track release count', () => {
      const obj = pool.acquire();
      pool.release(obj);
      expect(pool.getStats().releaseCount).toBe(1);
    });

    it('should track creation count', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();
      expect(pool.getStats().createdCount).toBe(5);
    });

    it('should track peak in-use count', () => {
      const objs = [];
      for (let i = 0; i < 3; i++) objs.push(pool.acquire());
      expect(pool.getStats().peakInUse).toBe(3);
      pool.release(objs[0]);
      expect(pool.getStats().peakInUse).toBe(3);
    });
  });

  describe('bulk acquire/release', () => {
    it('should acquire multiple objects at once', () => {
      const objs = pool.acquireMultiple(3);
      expect(objs).toHaveLength(3);
      expect(pool.available()).toBe(2);
    });

    it('should release multiple objects at once', () => {
      const objs = pool.acquireMultiple(3);
      pool.releaseMultiple(objs);
      expect(pool.available()).toBe(5);
    });

    it('should return fewer objects if pool is constrained', () => {
      const limitedPool = new ObjectPool({
        create: () => createTestObject(0),
        reset: (obj) => obj.reset(),
        initialSize: 0,
        maxSize: 2,
      });
      const objs = limitedPool.acquireMultiple(5);
      expect(objs).toHaveLength(2);
    });
  });
});
