import process from 'node:process'
import { app } from '../src/app'
import env from '../src/env'

const response = await app.handle(new Request(`http://localhost${env.apiPrefix}${env.openapiUrl}/json`))
if (!response.ok) { throw new Error(`OpenAPI export failed: ${response.status}`) }
const path = Bun.argv[2] ?? './openapi.json'
await Bun.write(path, `${JSON.stringify(await response.json(), null, 2)}\n`)
console.info(`OpenAPI exported to ${path}`)

process.exit(0)
