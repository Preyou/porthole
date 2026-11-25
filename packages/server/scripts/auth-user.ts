import process from 'node:process'
import { ZodError } from 'zod'
import { createLocalAccount } from '../src/auth/local'
import { RESPONSE_CODES } from '../src/constants/responseCodeMap'
import env from '../src/env'
import { ResponseCodeError } from '../src/errors/responseCode'

const [username, name = username] = Bun.argv.slice(2)
if (env.authMode !== 'local') {
  console.error('auth:user requires AUTH_MODE=local')
  process.exit(1)
}
if (!username || !name || process.stdin.isTTY) {
  console.error('Usage: provide password on standard input to bun run auth:user -- <username> [name]')
  process.exit(1)
}
try {
  const password = (await Bun.stdin.text()).replace(/\r?\n$/, '')
  await createLocalAccount({ name, password, username })
  console.info('Local account created.')
  process.exit(0)
}
catch (error) {
  if (error instanceof ZodError) { console.error('Invalid account input. Username needs 3–64 characters and password needs 12–256 characters.') }
  else if (error instanceof ResponseCodeError && error.code === RESPONSE_CODES.CONFLICT) { console.error('Username already exists.') }
  else { console.error('Local account creation failed. Check the database connection and migrations.') }
  process.exit(1)
}
