import { generateId } from '../id'

describe('generateId', () => {
  it('should generate an id with no prefix when none provided', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('should generate an id with the given prefix', () => {
    const id = generateId('task_')
    expect(id).toMatch(/^task_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('should generate an id with msg_ prefix', () => {
    const id = generateId('msg_')
    expect(id).toMatch(/^msg_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('should generate unique ids on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('should produce a valid RFC 4122 v4 UUID', () => {
    const id = generateId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    expect(id).toMatch(uuidRegex)
  })

  it('should be 36 characters long (standard UUID)', () => {
    const id = generateId()
    expect(id).toHaveLength(36)
  })
})
