export class MinHeap<T> {
  private heap: T[] = [];
  private positionMap = new Map<T, number>();
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  push(value: T): void {
    this.heap.push(value);
    const index = this.heap.length - 1;
    this.positionMap.set(value, index);
    this.bubbleUp(index);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    this.positionMap.delete(min);
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.positionMap.set(last, 0);
      this.sinkDown(0);
    }
    return min;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  size(): number {
    return this.heap.length;
  }

  decreaseKey(item: T): void {
    const idx = this.positionMap.get(item);
    if (idx === undefined) return;
    this.bubbleUp(idx);
    const currentIdx = this.positionMap.get(item);
    if (currentIdx !== undefined) {
      this.sinkDown(currentIdx);
    }
  }

  contains(item: T): boolean {
    return this.positionMap.has(item);
  }

  find(match: (item: T) => boolean): T | undefined {
    return this.heap.find(match);
  }

  clear(): void {
    this.heap.length = 0;
    this.positionMap.clear();
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIdx = (index - 1) >> 1;
      if (this.compare(this.heap[index], this.heap[parentIdx]) >= 0) break;
      this.swap(index, parentIdx);
      index = parentIdx;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
    this.positionMap.set(this.heap[i], i);
    this.positionMap.set(this.heap[j], j);
  }
}
