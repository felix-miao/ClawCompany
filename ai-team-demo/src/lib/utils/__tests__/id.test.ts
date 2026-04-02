import { generateId } from '../id'

describe('generateId', () => {
  it('should generate an id with no prefix when none provided', () => {
    const id = generateId()
    expect(id).toMatch(/^\d+-[a-z0-9]+$/)
  })

  it('should generate an id with the given prefix', () => {
    const id = generateId('task_')
    expect(id).toMatch(/^task_\d+-[a-z0-9]+$/)
  })

  it('should generate an id with msg_ prefix', () => {
    const id = generateId('msg_')
    expect(id).toMatch(/^msg_\d+-[a-z0-9]+$/)
  })

  it('should generate unique ids on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('should include a timestamp component', () => {
    const before = Date.now()
    const id = generateId()
    const after = Date.now()
    const timestamp = parseInt(id.split('-')[0], 10)
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('should include a random component with sufficient entropy', () => {
    const id = generateId()
    const parts = id.split('-')
    expect(parts.length).toBeGreaterThanOrEqual(2)
    expect(parts[parts.length - 1].length).toBeGreaterThanOrEqual(9)
  })
})
