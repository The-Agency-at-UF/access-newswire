/**
 * Per-call cost for the `generations` log (AGENTS.md §10).
 *
 * List prices in USD per million tokens, as published 2026-10-06. Confirm
 * against https://platform.claude.com/docs/en/about-claude/pricing before
 * using these for a budget; they only estimate what a call cost.
 */

import { MODELS, type ModelId } from './models'

interface Rates {
  input: number
  output: number
  cacheRead: number
}

const RATES: Record<ModelId, Rates> = {
  [MODELS.opus]: { input: 4, output: 20, cacheRead: 0.2 },
  [MODELS.sonnet]: { input: 2, output: 10, cacheRead: 0.2 },
  // Haiku 5.5's cache-read rate isn't in our price sheet; assumed at the usual 0.1x input.
  [MODELS.haiku]: { input: 0.1, output: 0.5, cacheRead: 0.01 },
}

/** Haiku 5.5 bills prompts over 100K tokens at a higher rate. */
const HAIKU_LONG_PROMPT: Rates = { input: 0.5, output: 2.5, cacheRead: 0.05 }
const HAIKU_LONG_PROMPT_THRESHOLD = 100_000

/** 5-minute cache writes cost 1.25x base input. */
const CACHE_WRITE_MULTIPLIER = 1.25

/** Web search: $10 per 1,000 searches. */
const WEB_SEARCH_USD = 10 / 1000

export interface UsageLike {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

export function costUsd(model: string, usage: UsageLike): number | null {
  const base = RATES[model as ModelId]
  if (!base) return null

  const cacheWrite = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const promptTokens = usage.input_tokens + cacheWrite + cacheRead
  const rates = model === MODELS.haiku && promptTokens > HAIKU_LONG_PROMPT_THRESHOLD ? HAIKU_LONG_PROMPT : base

  const tokens =
    usage.input_tokens * rates.input +
    cacheWrite * rates.input * CACHE_WRITE_MULTIPLIER +
    cacheRead * rates.cacheRead +
    usage.output_tokens * rates.output
  const searches = (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD

  return Math.round((tokens / 1_000_000 + searches) * 1_000_000) / 1_000_000
}
