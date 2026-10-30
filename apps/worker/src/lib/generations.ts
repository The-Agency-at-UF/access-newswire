import type { CallMeta } from '@access/ai'
import type { TaskContext } from '../context'

/** One `generations` row per Claude call (AGENTS.md §10). Returns its id. */
export async function logGeneration(
  ctx: TaskContext,
  task: string,
  call: CallMeta,
  frameworkId: string | null,
  inputs: Record<string, unknown>,
): Promise<string> {
  const [row] = await ctx.sql<{ id: string }[]>`
    insert into public.generations (
      org_id, job_id, framework_id, model, task, inputs,
      input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens,
      cost_usd, latency_ms, stop_reason, request_id
    ) values (
      ${ctx.job.org_id}, ${ctx.job.id}, ${frameworkId}, ${call.model}, ${task}, ${ctx.sql.json(inputs as never)},
      ${call.usage.input_tokens}, ${call.usage.output_tokens},
      ${call.usage.cache_creation_input_tokens ?? null}, ${call.usage.cache_read_input_tokens ?? null},
      ${call.costUsd}, ${call.latencyMs}, ${call.stopReason}, ${call.requestId}
    ) returning id`
  return row!.id
}
