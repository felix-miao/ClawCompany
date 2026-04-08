import { ErrorSeverity, ErrorCategory, AppError, ValidationError, isAppError, toAppError } from '@/lib/core/errors'
import { generateId } from '@/lib/utils/id'

describe('Jest smoke test - ai-team-demo', () => {
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

  test('module import works - errors', () => {
    const err = new AppError('TEST_001', 'test error', ErrorCategory.SYSTEM)
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('TEST_001')
    expect(err.message).toBe('test error')
    expect(err.category).toBe(ErrorCategory.SYSTEM)
    expect(err.severity).toBe(ErrorSeverity.MEDIUM)
  })

  test('module import works - ValidationError', () => {
    const err = new ValidationError('invalid input', { field: 'name' })
    expect(err.name).toBe('ValidationError')
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.context).toEqual({ field: 'name' })
  })

  test('module import works - isAppError / toAppError', () => {
    const appErr = new AppError('X', 'msg', ErrorCategory.AGENT)
    expect(isAppError(appErr)).toBe(true)
    expect(isAppError(new Error('plain'))).toBe(false)
    const converted = toAppError(new Error('plain'))
    expect(isAppError(converted)).toBe(true)
  })

  test('module import works - generateId', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const prefixed = generateId('task-')
    expect(prefixed).toMatch(/^task-[0-9a-f-]+$/)
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
})
