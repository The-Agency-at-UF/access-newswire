/**
 * Voyage embeddings for retrieval (AGENTS.md §3). Worker only: VOYAGE_API_KEY
 * never reaches the browser, which is why UI search is keyword-only.
 *
 * Vectors are 1024-dimensional to match document_chunks.embedding.
 */

export const EMBEDDING_DIMENSIONS = 1024
const DEFAULT_MODEL = 'voyage-3.5'
const BATCH_SIZE = 64

export type EmbeddingInput = 'document' | 'query'

export interface EmbedResult {
  vectors: number[][]
  model: string
  totalTokens: number
}

interface VoyageResponse {
  data: { embedding: number[]; index: number }[]
  model: string
  usage: { total_tokens: number }
}

export async function embed(
  texts: string[],
  inputType: EmbeddingInput,
  { apiKey = process.env.VOYAGE_API_KEY, model = process.env.VOYAGE_MODEL ?? DEFAULT_MODEL } = {},
): Promise<EmbedResult> {
  if (!apiKey) throw new Error('Missing env: VOYAGE_API_KEY (worker only).')

  const vectors: number[][] = []
  let totalTokens = 0

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE)
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: batch, model, input_type: inputType, output_dimension: EMBEDDING_DIMENSIONS }),
    })
    if (!response.ok) {
      throw new Error(`Voyage ${response.status}: ${(await response.text()).slice(0, 300)}`)
    }
    const json = (await response.json()) as VoyageResponse
    for (const row of [...json.data].sort((a, b) => a.index - b.index)) vectors.push(row.embedding)
    totalTokens += json.usage.total_tokens
  }

  return { vectors, model, totalTokens }
}

/** pgvector's text form: "[0.1,0.2,…]". */
export function toPgVector(vector: number[]): string {
  return `[${vector.join(',')}]`
}
