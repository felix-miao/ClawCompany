import { execFileSync } from 'child_process'

const ISSUE_239_RULES = [
  '@typescript-eslint/no-unused-vars',
  'import/order',
  'no-console',
] as const

describe('lint baseline', () => {
  it('keeps #239 lint warning families at zero', async () => {
    const output = execFileSync('npx', ['eslint', 'src', '--ext', '.ts,.tsx', '-f', 'json'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
    })
    const results: Array<{ messages: Array<{ ruleId: string | null }> }> = JSON.parse(output)
    const counts = Object.fromEntries(ISSUE_239_RULES.map((ruleId) => [ruleId, 0]))

    for (const result of results) {
      for (const message of result.messages) {
        if (message.ruleId && message.ruleId in counts) {
          counts[message.ruleId] += 1
        }
      }
    }

    expect(counts).toEqual({
      '@typescript-eslint/no-unused-vars': 0,
      'import/order': 0,
      'no-console': 0,
    })
  })
})
