/**
 * Plain text from an uploaded file, for indexing. Returns null for types we
 * don't read (images, audio, archives), which marks the document `skipped`.
 */

import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'

export function kindOf(mime: string | null, filename: string): 'pdf' | 'docx' | 'text' | 'html' | null {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  const type = (mime ?? '').toLowerCase()
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (type.includes('wordprocessingml') || ext === 'docx') return 'docx'
  if (type === 'text/html' || ext === 'html' || ext === 'htm') return 'html'
  if (type.startsWith('text/') || ['txt', 'md', 'csv', 'eml', 'json'].includes(ext) || type === 'message/rfc822') return 'text'
  return null
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim()
}

export async function extractTextFrom(bytes: Uint8Array, mime: string | null, filename: string): Promise<string | null> {
  switch (kindOf(mime, filename)) {
    case 'pdf': {
      const pdf = await getDocumentProxy(bytes)
      const { text } = await extractText(pdf, { mergePages: false })
      return text.join('\n\n')
    }
    case 'docx': {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
      return value
    }
    case 'html':
      return htmlToText(new TextDecoder().decode(bytes))
    case 'text':
      return new TextDecoder().decode(bytes)
    default:
      return null
  }
}
