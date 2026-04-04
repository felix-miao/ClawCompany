import { MinHeap } from '../MinHeap';

describe('MinHeap', () => {
  let heap: MinHeap<{ f: number; id: string }>;

  beforeEach(() => {
    heap = new MinHeap<{ f: number; id: string }>((a, b) => a.f - b.f);
  });

  describe('constructor', () => {
    it('should create an empty heap', () => {
      expect(heap.size()).toBe(0);
    });
  });

  describe('push', () => {
    it('should add a single element', () => {
      heap.push({ f: 5, id: 'a' });
      expect(heap.size()).toBe(1);
    });

    it('should maintain heap property with multiple elements', () => {
      heap.push({ f: 10, id: 'a' });
      heap.push({ f: 5, id: 'b' });
      heap.push({ f: 15, id: 'c' });
      heap.push({ f: 3, id: 'd' });
      expect(heap.peek()!.f).toBe(3);
    });
  });

  describe('pop', () => {
    it('should return undefined for empty heap', () => {
      expect(heap.pop()).toBeUndefined();
    });

    it('should return the minimum element', () => {
      heap.push({ f: 10, id: 'a' });
      heap.push({ f: 3, id: 'b' });
      heap.push({ f: 7, id: 'c' });
      expect(heap.pop()!.f).toBe(3);
      expect(heap.pop()!.f).toBe(7);
      expect(heap.pop()!.f).toBe(10);
      expect(heap.pop()).toBeUndefined();
    });

    it('should handle many elements in sorted order', () => {
      const values = [5, 3, 8, 1, 9, 2, 7, 4, 6];
      values.forEach(v => heap.push({ f: v, id: String(v) }));
      const sorted: number[] = [];
      while (heap.size() > 0) {
        sorted.push(heap.pop()!.f);
      }
      expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('peek', () => {
    it('should return undefined for empty heap', () => {
      expect(heap.peek()).toBeUndefined();
    });

    it('should return minimum without removing it', () => {
      heap.push({ f: 5, id: 'a' });
      heap.push({ f: 2, id: 'b' });
      expect(heap.peek()!.f).toBe(2);
      expect(heap.size()).toBe(2);
    });
  });

  describe('decreaseKey', () => {
    it('should re-heapify when item priority is decreased by reference', () => {
      const nodeA = { f: 10, id: 'a' };
      const nodeB = { f: 5, id: 'b' };
      heap.push(nodeA);
      heap.push(nodeB);
      nodeA.f = 1;
      heap.decreaseKey(nodeA);
      expect(heap.peek()!.id).toBe('a');
      expect(heap.peek()!.f).toBe(1);
    });

    it('should handle decreaseKey on the root element', () => {
      const node = { f: 5, id: 'a' };
      heap.push(node);
      heap.push({ f: 10, id: 'b' });
      node.f = 0;
      heap.decreaseKey(node);
      expect(heap.peek()!.f).toBe(0);
      expect(heap.pop()!.id).toBe('a');
    });

    it('should do nothing for item not in heap', () => {
      const nodeA = { f: 5, id: 'a' };
      const nodeB = { f: 10, id: 'b' };
      const nodeC = { f: 1, id: 'c' };
      heap.push(nodeA);
      heap.push(nodeB);
      heap.decreaseKey(nodeC);
      expect(heap.size()).toBe(2);
      expect(heap.peek()!.f).toBe(5);
    });

    it('should correctly re-heapify deeply nested elements', () => {
      const nodes = [
        { f: 50, id: 'a' },
        { f: 40, id: 'b' },
        { f: 30, id: 'c' },
        { f: 20, id: 'd' },
        { f: 10, id: 'e' },
      ];
      nodes.forEach(n => heap.push(n));
      nodes[4].f = 1;
      heap.decreaseKey(nodes[4]);
      expect(heap.peek()!.id).toBe('e');
      expect(heap.pop()!.f).toBe(1);
    });
  });

  describe('contains', () => {
    it('should return true for items in the heap', () => {
      const node = { f: 5, id: 'a' };
      heap.push(node);
      expect(heap.contains(node)).toBe(true);
    });

    it('should return false for items not in the heap', () => {
      const node = { f: 5, id: 'a' };
      expect(heap.contains(node)).toBe(false);
    });

    it('should return false after item is popped', () => {
      const node = { f: 5, id: 'a' };
      heap.push(node);
      heap.pop();
      expect(heap.contains(node)).toBe(false);
    });

    it('should return false after clear', () => {
      const node = { f: 5, id: 'a' };
      heap.push(node);
      heap.clear();
      expect(heap.contains(node)).toBe(false);
    });

    it('should distinguish between different object references', () => {
      const node1 = { f: 5, id: 'a' };
      const node2 = { f: 5, id: 'a' };
      heap.push(node1);
      expect(heap.contains(node1)).toBe(true);
      expect(heap.contains(node2)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all elements', () => {
      heap.push({ f: 5, id: 'a' });
      heap.push({ f: 3, id: 'b' });
      heap.clear();
      expect(heap.size()).toBe(0);
    });

    it('should allow pushes after clear', () => {
      heap.push({ f: 5, id: 'a' });
      heap.clear();
      heap.push({ f: 3, id: 'b' });
      expect(heap.size()).toBe(1);
      expect(heap.peek()!.f).toBe(3);
    });
  });

  describe('performance', () => {
    it('should handle 10000 push/pop operations quickly', () => {
      const start = performance.now();
      for (let i = 10000; i >= 0; i--) {
        heap.push({ f: i, id: String(i) });
      }
      for (let i = 0; i <= 10000; i++) {
        heap.pop();
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('should make decreaseKey O(log n) with position map', () => {
      const nodes: { f: number; id: string }[] = [];
      const size = 5000;

      for (let i = 0; i < size; i++) {
        const node = { f: i + 100, id: String(i) };
        nodes.push(node);
        heap.push(node);
      }

      const start = performance.now();
      for (let i = 0; i < size; i++) {
        nodes[i].f = i;
        heap.decreaseKey(nodes[i]);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);

      for (let i = 0; i < size; i++) {
        const popped = heap.pop()!;
        expect(popped.id).toBe(String(i));
      }
    });
  });

  describe('position tracking correctness', () => {
    it('should maintain correct heap order after mixed operations', () => {
      const a = { f: 10, id: 'a' };
      const b = { f: 20, id: 'b' };
      const c = { f: 30, id: 'c' };
      const d = { f: 40, id: 'd' };

      heap.push(a);
      heap.push(b);
      heap.push(c);
      heap.push(d);

      c.f = 5;
      heap.decreaseKey(c);
      expect(heap.pop()).toBe(c);

      d.f = 8;
      heap.decreaseKey(d);
      expect(heap.pop()).toBe(d);

      expect(heap.pop()).toBe(a);
      expect(heap.pop()).toBe(b);
    });

    it('should track positions correctly across many decreaseKey calls', () => {
      const nodes: { f: number; id: string }[] = [];
      for (let i = 0; i < 100; i++) {
        const node = { f: 100 - i, id: String(i) };
        nodes.push(node);
        heap.push(node);
      }

      for (let i = 0; i < 100; i++) {
        nodes[i].f = i;
        heap.decreaseKey(nodes[i]);
      }

      const results: string[] = [];
      while (heap.size() > 0) {
        results.push(heap.pop()!.id);
      }

      for (let i = 0; i < 100; i++) {
        expect(results[i]).toBe(String(i));
      }
    });
  });
});
