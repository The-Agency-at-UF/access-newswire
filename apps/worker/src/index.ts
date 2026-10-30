/**
 * Worker entry point: `pnpm --filter @access/worker dev` locally, or the
 * Dockerfile on any container host. Stops cleanly on SIGINT/SIGTERM so an
 * in-flight job finishes or returns to the queue.
 */

import { loadEnv } from './env'
import { connect, storageClient } from './lib/db'
import { startWorker } from './queue'
import { TASKS } from './tasks'

function log(message: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...extra }))
}

let env: ReturnType<typeof loadEnv>
try {
  env = loadEnv()
} catch (error) {
  // Not configured yet: say so and step aside rather than failing `pnpm dev`.
  log('worker not started', { reason: (error as Error).message })
  process.exit(0)
}

const sql = connect(env)
const worker = startWorker({ env, sql, storage: storageClient(env), tasks: TASKS, log })

let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (stopping) process.exit(1)
    stopping = true
    log('stopping', { signal })
    await worker.stop()
    await sql.end({ timeout: 5 })
    process.exit(0)
  })
}
