import * as fs from 'fs/promises'
import * as path from 'path'

import { checkRepoHygiene } from '../repo-hygiene'

describe('repo hygiene', () => {
  it('reports missing ignore rules and tracked dirty files', async () => {
    const rootDir = path.resolve(process.cwd())
    const result = await checkRepoHygiene(rootDir)

    expect(result.missingIgnoreRules).toEqual([])
    expect(result.trackedFiles).not.toContain('.DS_Store')
    expect(result.trackedFiles).not.toContain('node_modules')
  })

  it('treats a local .gitignore file as parseable input', async () => {
    const tempDir = path.join('/tmp', `clawcompany-hygiene-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(path.join(tempDir, '.gitignore'), '.DS_Store\nnode_modules/\n')

    const result = await checkRepoHygiene(tempDir)

    expect(result.missingIgnoreRules).toEqual([])

    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('ignores comments and partial matches when checking gitignore rules', async () => {
    const tempDir = path.join('/tmp', `clawcompany-hygiene-${Date.now()}-comments`)
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(
      path.join(tempDir, '.gitignore'),
      ['# .DS_Store', 'some/.DS_Store.backup', '', '# node_modules/', 'packages/node_modules-cache'].join('\n'),
    )

    const result = await checkRepoHygiene(tempDir)

    expect(result.missingIgnoreRules).toEqual(['.DS_Store', 'node_modules/'])

    await fs.rm(tempDir, { recursive: true, force: true })
  })
})
