describe('Jest smoke test - skill', () => {
  test('jest environment is working', () => {
    expect(1 + 1).toBe(2)
    expect(typeof jest).toBe('object')
    expect(typeof describe).toBe('function')
    expect(typeof it).toBe('function')
    expect(typeof expect).toBe('function')
  })

  test('TypeScript compilation works', () => {
    const greet = (name: string): string => `Hello, ${name}!`
    expect(greet('Jest')).toBe('Hello, Jest!')
  })

  test('async/await works', async () => {
    const resolve = () => new Promise<string>((r) => setTimeout(() => r('done'), 10))
    const result = await resolve()
    expect(result).toBe('done')
  })

  test('mock functionality works', () => {
    const fn = jest.fn().mockReturnValue(42)
    expect(fn()).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('jest.expect matchers work', () => {
    expect([1, 2, 3]).toHaveLength(3)
    expect({ a: 1, b: 2 }).toMatchObject({ a: 1 })
    expect('hello world').toContain('world')
    expect(() => { throw new Error('boom') }).toThrow('boom')
  })

  test('beforeEach/afterEach hooks work', () => {
    let counter = 0
    const increment = () => { counter++ }
    increment()
    expect(counter).toBe(1)
  })
})
