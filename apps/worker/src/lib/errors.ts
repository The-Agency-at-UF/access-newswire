/**
 * Which failures are worth retrying. A refusal, a malformed output, a gate the
 * database enforces, or bad input will fail the same way again.
 */

import { InvalidOutputError, RefusalError } from '@access/ai'
import { ZodError } from 'zod'

/** Thrown by a task for a problem retrying can't fix (missing config, bad input). */
export class PermanentError extends Error {
  override name = 'PermanentError'
}

interface PostgresErrorLike {
  code?: string
  message?: string
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof PermanentError || error instanceof RefusalError || error instanceof InvalidOutputError) return false
  if (error instanceof ZodError) return false
  const code = (error as PostgresErrorLike | null)?.code
  // P0001: a rule raised by the schema (stage gate, do-not-contact, append-only).
  // 23xxx: constraint violations. 42501: permission. 22xxx: bad data.
  if (code && (code === 'P0001' || code === 'P0002' || code.startsWith('23') || code === '42501' || code.startsWith('22'))) {
    return false
  }
  return true
}

export function describe(error: unknown): string {
  if (error instanceof ZodError) {
    return `invalid job input: ${error.issues.map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`).join('; ')}`
  }
  if (error instanceof Error) return error.message
  return String(error)
}

/** Seconds before a failed job is tried again: 30s, 2m, 8m, … capped at 30m. */
export function backoffSeconds(attempt: number): number {
  return Math.min(30 * 4 ** Math.max(0, attempt - 1), 1800)
}
