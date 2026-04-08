import { ThrottleSystem } from '../ThrottleSystem';

describe('ThrottleSystem', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('throttle', () => {
    it('should execute function immediately on first call', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const throttled = sys.throttle('test', fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should skip calls within throttle window', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const throttled = sys.throttle('test', fn, 100);

      throttled();
      throttled();
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow call after throttle window passes', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const throttled = sys.throttle('test', fn, 100);

      throttled();
      jest.advanceTimersByTime(150);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to throttled function', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const throttled = sys.throttle('test', fn, 100);

      throttled('arg1', 'arg2');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should manage multiple independent throttle keys', () => {
      const sys = new ThrottleSystem();
      const fn1 = jest.fn();
      const fn2 = jest.fn();

      const t1 = sys.throttle('key1', fn1, 100);
      const t2 = sys.throttle('key2', fn2, 200);

      t1();
      t2();
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(150);
      t1();
      t2();
      expect(fn1).toHaveBeenCalledTimes(2);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const debounced = sys.debounce('test', fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent calls', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const debounced = sys.debounce('test', fn, 100);

      debounced();
      jest.advanceTimersByTime(50);
      debounced();
      jest.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass latest arguments', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const debounced = sys.debounce('test', fn, 100);

      debounced('first');
      debounced('second');
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('second');
    });
  });

  describe('rate limit', () => {
    it('should enforce rate limit', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const limited = sys.rateLimit('test', fn, { maxCalls: 3, windowMs: 1000 });

      limited();
      limited();
      limited();
      limited();
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should reset after window passes', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const limited = sys.rateLimit('test', fn, { maxCalls: 2, windowMs: 1000 });

      limited();
      limited();
      limited();
      expect(fn).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(1000);
      limited();
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancel', () => {
    it('should cancel throttle for a key', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const throttled = sys.throttle('test', fn, 100);

      throttled();
      sys.cancel('test');
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should cancel debounce for a key', () => {
      const sys = new ThrottleSystem();
      const fn = jest.fn();
      const debounced = sys.debounce('test', fn, 100);

      debounced();
      sys.cancel('test');
      jest.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should cancel all throttles and debounces', () => {
      const sys = new ThrottleSystem();
      const fn1 = jest.fn();
      const fn2 = jest.fn();

      sys.throttle('t1', fn1, 100);
      sys.debounce('d1', fn2, 100);
      sys.cancelAll();
      expect(sys.getActiveCount()).toBe(0);
    });
  });

  describe('getActiveCount', () => {
    it('should track number of active throttle/debounce entries', () => {
      const sys = new ThrottleSystem();
      expect(sys.getActiveCount()).toBe(0);

      sys.throttle('t1', jest.fn(), 100);
      sys.debounce('d1', jest.fn(), 100);
      expect(sys.getActiveCount()).toBe(2);
    });
  });
});
