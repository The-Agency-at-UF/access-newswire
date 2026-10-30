/**
 * Claude calls. Server-side only (AGENTS.md §2.5): the worker is the only
 * caller and the only holder of ANTHROPIC_API_KEY.
 *
 * Every call returns what the `generations` row needs (model, usage, cost,
 * latency, request id); the caller writes that row.
 */

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import type { Prompt } from './context'
import { FALLBACK_BETA, MODELS, ROUTES, supportsFallback, type GenerationTask } from './models'
import { costUsd, type UsageLike } from './pricing'
import { InvalidOutputError } from './schemas'

/** The SDK retries 408/409/429/5xx (including overloaded) with backoff. */
export function createClaude(apiKey = process.env.ANTHROPIC_API_KEY): Anthropic {
  if (!apiKey) throw new Error('Missing env: ANTHROPIC_API_KEY (worker only).')
  return new Anthropic({ apiKey, maxRetries: 4 })
}

export class RefusalError extends Error {
  override name = 'RefusalError'
  constructor(readonly category: string | null) {
    super(`Claude declined this request${category ? ` (${category})` : ''}.`)
  }
}

export interface CallMeta {
  model: string
  usage: UsageLike
  costUsd: number | null
  latencyMs: number
  stopReason: string | null
  requestId: string | null
}

function fallbackParams(model: string) {
  return supportsFallback(model as (typeof MODELS)[keyof typeof MODELS])
    ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const }
    : {}
}

function checkStop(stopReason: string | null, stopDetails: { category?: string | null } | null | undefined) {
  if (stopReason === 'refusal') throw new RefusalError(stopDetails?.category ?? null)
  if (stopReason === 'max_tokens') throw new InvalidOutputError('output was cut off at max_tokens')
}

/** One structured call: the prompt in, a schema-valid object out. */
export async function generateStructured<S extends z.ZodType>(
  client: Anthropic,
  task: GenerationTask,
  prompt: Prompt,
  schema: S,
): Promise<{ output: z.infer<S> } & CallMeta> {
  const route = ROUTES[task]
  const started = Date.now()

  const response = await client.beta.messages.parse({
    model: route.model,
    max_tokens: route.maxTokens,
    system: prompt.system,
    messages: prompt.messages,
    output_config: { effort: route.effort, format: betaZodOutputFormat(schema) },
    ...fallbackParams(route.model),
  })

  checkStop(response.stop_reason, response.stop_details)
  if (response.parsed_output == null) throw new InvalidOutputError('response did not match the output schema')

  return {
    output: response.parsed_output as z.infer<S>,
    model: response.model,
    usage: response.usage,
    costUsd: costUsd(response.model, response.usage),
    latencyMs: Date.now() - started,
    stopReason: response.stop_reason,
    requestId: response._request_id ?? null,
  }
}

export interface FoundSource {
  url: string
  title: string
}

/**
 * Research with Claude's server-side web search. Returns findings as prose
 * plus every source the searches returned; a second, structured call turns
 * the findings into the research schema, citing only these sources.
 *
 * (Structured output and web-search citations can't share one request.)
 */
export async function researchWithWebSearch(
  client: Anthropic,
  prompt: Prompt,
  maxSearches = 8,
): Promise<{ findings: string; sources: FoundSource[] } & CallMeta> {
  const route = ROUTES['research.run']
  const started = Date.now()
  const messages: Anthropic.Beta.BetaMessageParam[] = [...prompt.messages]
  const usage: Required<Pick<UsageLike, 'input_tokens' | 'output_tokens'>> & {
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
    server_tool_use: { web_search_requests: number }
  } = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    server_tool_use: { web_search_requests: 0 },
  }

  const text: string[] = []
  const sources = new Map<string, string>()
  let last: Anthropic.Beta.BetaMessage | null = null
  let requestId: string | null = null

  // The server-side search loop can pause; resume by sending the turn back.
  for (let turn = 0; turn < 5; turn++) {
    const stream = client.beta.messages.stream({
      model: route.model,
      max_tokens: route.maxTokens,
      system: prompt.system,
      messages,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches }],
      output_config: { effort: route.effort },
      ...fallbackParams(route.model),
    })
    const response = await stream.finalMessage()
    last = response
    requestId = stream.request_id ?? requestId

    usage.input_tokens += response.usage.input_tokens
    usage.output_tokens += response.usage.output_tokens
    usage.cache_creation_input_tokens += response.usage.cache_creation_input_tokens ?? 0
    usage.cache_read_input_tokens += response.usage.cache_read_input_tokens ?? 0
    usage.server_tool_use.web_search_requests += response.usage.server_tool_use?.web_search_requests ?? 0

    for (const block of response.content) {
      if (block.type === 'text') text.push(block.text)
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const result of block.content) sources.set(result.url, result.title)
      }
    }

    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }

  checkStop(last?.stop_reason ?? null, last?.stop_details)

  return {
    findings: text.join('').trim(),
    sources: [...sources].map(([url, title]) => ({ url, title })),
    model: last?.model ?? route.model,
    usage,
    costUsd: costUsd(last?.model ?? route.model, usage),
    latencyMs: Date.now() - started,
    stopReason: last?.stop_reason ?? null,
    requestId,
  }
}
