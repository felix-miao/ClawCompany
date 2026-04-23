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
    expect(result.unexpectedPackageRoots).toEqual([])
  })

  it('treats a local .gitignore file as parseable input', async () => {
    const tempDir = path.join('/tmp', `clawcompany-hygiene-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(path.join(tempDir, '.gitignore'), '.DS_Store\nnode_modules/\n.opencode/\n')

    const result = await checkRepoHygiene(tempDir)

    expect(result.missingIgnoreRules).toEqual([])
    expect(result.unexpectedPackageRoots).toEqual([])

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

    expect(result.missingIgnoreRules).toEqual(['.DS_Store', 'node_modules/', '.opencode/'])
    expect(result.unexpectedPackageRoots).toEqual([])

    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('ignores runtime directories but flags nested package roots outside declared workspaces', async () => {
    const tempDir = path.join('/tmp', `clawcompany-hygiene-${Date.now()}-structure`)
    await fs.mkdir(path.join(tempDir, '.opencode', 'node_modules', 'nested-package'), { recursive: true })
    await fs.mkdir(path.join(tempDir, 'packages', 'app'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }))
    await fs.writeFile(path.join(tempDir, '.opencode', 'package.json'), JSON.stringify({ name: 'runtime', private: true }))
    await fs.writeFile(path.join(tempDir, '.opencode', 'node_modules', 'nested-package', 'package.json'), JSON.stringify({ name: 'nested' }))
    await fs.writeFile(path.join(tempDir, 'packages', 'app', 'package.json'), JSON.stringify({ name: 'declared' }))

    const result = await checkRepoHygiene(tempDir)

    expect(result.unexpectedPackageRoots).toEqual([])

    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('flags nested package roots that are not ignored or declared as workspaces', async () => {
    const tempDir = path.join('/tmp', `clawcompany-hygiene-${Date.now()}-packages`)
    await fs.mkdir(path.join(tempDir, 'tools', 'helper'), { recursive: true })
    await fs.mkdir(path.join(tempDir, 'packages', 'app'), { recursive: true })
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }))
    await fs.writeFile(path.join(tempDir, 'tools', 'helper', 'package.json'), JSON.stringify({ name: 'helper' }))
    await fs.writeFile(path.join(tempDir, 'packages', 'app', 'package.json'), JSON.stringify({ name: 'declared' }))

    const result = await checkRepoHygiene(tempDir)

    expect(result.unexpectedPackageRoots).toEqual(['tools/helper/package.json'])

    await fs.rm(tempDir, { recursive: true, force: true })
  })
})
