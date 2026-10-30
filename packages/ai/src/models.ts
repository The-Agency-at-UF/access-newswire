/**
 * Model routing (AGENTS.md §10). The only place model ids appear.
 */

export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS]

/** Every task that calls Claude. Matches `jobs.type` (and `generations.task`). */
export type GenerationTask =
  | 'email.classify'
  | 'research.run'
  | 'onboarding.generate'
  | 'strategy.phase'
  | 'release.draft'
  | 'release.edit'
  | 'medialist.build'
  | 'pitches.generate'

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface Route {
  model: ModelId
  /** Thinking depth / token spend. Tune per task against real output, not globally. */
  effort: Effort
  /** Capped at 20K: the SDK refuses non-streaming calls that could outlast 10 minutes. */
  maxTokens: number
}

export const ROUTES: Record<GenerationTask, Route> = {
  // Inbox labeling and extraction: Haiku.
  'email.classify': { model: MODELS.haiku, effort: 'low', maxTokens: 2_000 },
  // Release drafts, L2 edits, pitches, media list ranking: Sonnet.
  'release.draft': { model: MODELS.sonnet, effort: 'medium', maxTokens: 16_000 },
  'release.edit': { model: MODELS.sonnet, effort: 'medium', maxTokens: 16_000 },
  'medialist.build': { model: MODELS.sonnet, effort: 'medium', maxTokens: 16_000 },
  'pitches.generate': { model: MODELS.sonnet, effort: 'medium', maxTokens: 20_000 },
  // Research, onboarding deck, six-month strategy: Opus.
  'research.run': { model: MODELS.opus, effort: 'high', maxTokens: 20_000 },
  'onboarding.generate': { model: MODELS.opus, effort: 'high', maxTokens: 20_000 },
  'strategy.phase': { model: MODELS.opus, effort: 'high', maxTokens: 20_000 },
}

/**
 * Opus 5.5 and Sonnet 5.5 can decline a request on safety grounds; with
 * server-side fallbacks the API re-runs it on a fallback model in the same
 * call. Haiku 5.5 has no server-side fallback.
 */
export function supportsFallback(model: ModelId): boolean {
  return model !== MODELS.haiku
}

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
