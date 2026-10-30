/**
 * Split extracted document text into retrieval chunks: paragraph-aligned,
 * roughly `targetTokens` long, with a little overlap so a fact split across a
 * boundary is still findable.
 */

/** Rough token count for English prose (~4 characters per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface Chunk {
  index: number
  content: string
  tokens: number
}

export function chunkText(text: string, { targetTokens = 500, overlapTokens = 60 } = {}): Chunk[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim()
  if (!normalized) return []

  const maxChars = targetTokens * 4
  const overlapChars = overlapTokens * 4

  // Paragraphs, with any single paragraph longer than a chunk split on sentences, then hard-wrapped.
  const pieces = normalized
    .split(/\n{2,}/)
    .flatMap((paragraph) => (paragraph.length <= maxChars ? [paragraph] : paragraph.split(/(?<=[.!?])\s+/)))
    .flatMap((piece) => {
      if (piece.length <= maxChars) return [piece]
      const parts: string[] = []
      for (let i = 0; i < piece.length; i += maxChars) parts.push(piece.slice(i, i + maxChars))
      return parts
    })
    .map((piece) => piece.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > maxChars) {
      chunks.push(current)
      const tail = current.slice(-overlapChars)
      const cut = tail.search(/\s/)
      current = cut >= 0 ? tail.slice(cut + 1) : ''
    }
    current = current ? `${current}\n\n${piece}` : piece
  }
  if (current) chunks.push(current)

  return chunks.map((content, index) => ({ index, content, tokens: estimateTokens(content) }))
}
