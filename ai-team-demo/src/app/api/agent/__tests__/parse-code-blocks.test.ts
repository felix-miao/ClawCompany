import { parseCodeBlocks } from '../parse-code-blocks'

describe('parseCodeBlocks', () => {
  it('should extract files from code blocks with file annotations', () => {
    const markdown = [
      '## Implementation',
      '',
      '```tsx',
      '// file: src/components/Test.tsx',
      'export function Test() { return <div>test</div> }',
      '```',
    ].join('\n')

    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/components/Test.tsx')
    expect(files[0].content).toContain('export function Test')
  })

  it('should extract multiple files from multiple code blocks', () => {
    const markdown = [
      '```tsx',
      '// file: src/a.tsx',
      'const a = 1',
      '```',
      '```tsx',
      '// file: src/b.tsx',
      'const b = 2',
      '```',
    ].join('\n')

    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(2)
    expect(files[0].path).toBe('src/a.tsx')
    expect(files[1].path).toBe('src/b.tsx')
  })

  it('should skip code blocks without file annotations', () => {
    const markdown = [
      '```tsx',
      'console.log("no file annotation")',
      '```',
    ].join('\n')

    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(0)
  })

  it('should handle code blocks without language specifier', () => {
    const markdown = [
      '```',
      '// file: src/plain.txt',
      'hello world',
      '```',
    ].join('\n')

    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/plain.txt')
  })

  it('should handle file annotation case-insensitively', () => {
    const markdown = [
      '```tsx',
      '// File: src/Component.tsx',
      'export const X = 1',
      '```',
    ].join('\n')

    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/Component.tsx')
  })

  it('should trim whitespace from file paths', () => {
    const markdown = [
      '```tsx',
      '// file:   src/spaces.tsx  ',
      'export const X = 1',
      '```',
    ].join('\n')

    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('src/spaces.tsx')
  })

  it('should return empty array for markdown with no code blocks', () => {
    expect(parseCodeBlocks('no code here')).toEqual([])
    expect(parseCodeBlocks('')).toEqual([])
  })

  it('should return properly typed CodeBlockFile objects', () => {
    const markdown = '```js\n// file: test.js\ncode\n```'
    const files = parseCodeBlocks(markdown)

    expect(files).toHaveLength(1)
    expect(typeof files[0].path).toBe('string')
    expect(typeof files[0].content).toBe('string')
  })
})
