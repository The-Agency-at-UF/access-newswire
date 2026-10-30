/**
 * Onboarding deck (.pptx), built in Node with pptxgenjs (decided 2026-10-20,
 * in place of python-pptx). Until the team's template is in the `templates`
 * bucket this draws a plain layout; filling the real template replaces it.
 */

import PptxGenJS from 'pptxgenjs'

export interface DeckSlide {
  heading: string
  body: string
  speaker_notes?: string | null
}

export interface DeckInput {
  title: string
  subtitle?: string | null
  slides: DeckSlide[]
}

const INK = '1A1B1E'
const MUTED = '6B6A65'

/** Body text → bullet lines: one per non-empty line, list markers stripped. */
export function bulletLines(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(Boolean)
}

export async function renderDeck(input: DeckInput): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = input.title

  const cover = pptx.addSlide()
  cover.addText(input.title, { x: 0.6, y: 2.4, w: 12, h: 1.2, fontSize: 40, bold: true, color: INK })
  if (input.subtitle) cover.addText(input.subtitle, { x: 0.6, y: 3.6, w: 12, h: 0.6, fontSize: 18, color: MUTED })

  for (const slide of input.slides) {
    const page = pptx.addSlide()
    page.addText(slide.heading, { x: 0.6, y: 0.4, w: 12, h: 0.9, fontSize: 28, bold: true, color: INK })
    page.addText(
      bulletLines(slide.body).map((line) => ({ text: line, options: { bullet: true, breakLine: true } })),
      { x: 0.6, y: 1.5, w: 12, h: 5.4, fontSize: 18, color: INK, valign: 'top' },
    )
    if (slide.speaker_notes) page.addNotes(slide.speaker_notes)
  }

  const out = await pptx.write({ outputType: 'nodebuffer' })
  return out as Buffer
}
