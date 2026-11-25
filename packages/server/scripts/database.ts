import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { authLifecycleSQL } from '../src/db/pg/schemas/authLifecycle'

const command = Bun.argv[2]
if (command !== 'generate' && command !== 'migrate') { throw new Error('Expected generate or migrate') }
const child = Bun.spawn(['bunx', 'drizzle-kit', command], { cwd: `${import.meta.dir}/..`, env: { ...import.meta.env, DATABASE_URL: command === 'migrate' ? import.meta.env.MIGRATION_DATABASE_URL || import.meta.env.DATABASE_URL : import.meta.env.DATABASE_URL }, stderr: 'inherit', stdout: 'inherit' })
if (await child.exited !== 0) { process.exit(child.exitCode ?? 1) }
if (command === 'generate') {
  const migrationRoot = resolve(import.meta.dir, '../drizzle')
  const directories = (await readdir(migrationRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  const latest = directories.at(-1)
  if (!latest) { throw new Error('No generated migration found') }
  const path = resolve(migrationRoot, latest, 'migration.sql')
  const file = Bun.file(path)
  const sql = await file.text()
  if (directories.length === 1 && !sql.includes('yuumi_auth_before_update')) {
    // 生命周期定义属于 schema 源码，生成器只把定义附加到新初始 migration。
    await Bun.write(file, `${sql}
--> statement-breakpoint
${authLifecycleSQL}
--> statement-breakpoint
CREATE TRIGGER todos_before_update BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION yuumi_auth_before_update();
`)
  }
  const snapshotPath = resolve(migrationRoot, latest, 'snapshot.json')
  const snapshot = await Bun.file(snapshotPath).text()
  if (!snapshot.endsWith('\n')) { await Bun.write(snapshotPath, `${snapshot}\n`) }
}
