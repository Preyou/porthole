import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
async function git(args: string[], cwd: string) {
  const child = Bun.spawn(['git', ...args], { cwd, stderr: 'inherit', stdout: 'pipe' })
  const output = await new Response(child.stdout).text()
  if (await child.exited !== 0) { throw new Error(`Git failed: ${args.join(' ')}`) }
  return output.trim()
}
const temporary = await mkdtemp(resolve(tmpdir(), 'ngt-upgrade-'))
try {
  await git(['clone', '--quiet', '--filter=blob:none', 'git@github.com:Preyou/ngt-ui.git', temporary], root)
  const tags = (await git(['tag', '--sort=-version:refname'], temporary)).split('\n').filter(tag => /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag))
  let latest: string | undefined
  for (const tag of tags) {
    const manifest = JSON.parse(await git(['show', `${tag}:package.json`], temporary))
    if (manifest.name !== '@ngt/ui' || !manifest.ngt?.gitRelease?.sourceCommit) { continue }
    const child = Bun.spawn(['git', 'merge-base', '--is-ancestor', manifest.ngt.gitRelease.sourceCommit, 'origin/main'], { cwd: temporary, stderr: 'inherit', stdout: 'ignore' })
    if (await child.exited === 0) {
      latest = tag
      break
    }
  }
  if (!latest) { throw new Error('No stable prebuilt UI release found') }
  console.info(`Latest unified UI: ${latest}`)
  if (!Bun.argv.includes('--check')) {
    const path = resolve(root, 'package.json')
    const manifest = await Bun.file(path).json()
    manifest.dependencies['@ngt/ui'] = `git+ssh://git@github.com/Preyou/ngt-ui.git#${latest}`
    manifest.overrides = { ...manifest.overrides, '@ngt/ui': manifest.dependencies['@ngt/ui'] }
    await Bun.write(path, `${JSON.stringify(manifest, null, 2)}\n`)
    const child = Bun.spawn(['bun', 'install'], { cwd: root, stderr: 'inherit', stdout: 'inherit' })
    if (await child.exited !== 0) { throw new Error('Dependency installation failed') }
  }
}
finally { await rm(temporary, { force: true, recursive: true }) }
