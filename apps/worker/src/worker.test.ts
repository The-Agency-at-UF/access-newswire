import { describe, expect, it } from 'vitest'
import { InvalidOutputError, RefusalError } from '@access/ai'
import { backoffSeconds, isRetryable, PermanentError } from './lib/errors'
import { htmlToText, kindOf } from './lib/extract'
import { safeFilename } from './lib/files'
import { mention, slackEscape } from './lib/slack'
import { mergeSection } from './tasks/generate'
import { totals } from './tasks/stats-import'

describe('retry policy', () => {
  it('retries transient failures', () => {
    expect(isRetryable(new Error('ECONNRESET'))).toBe(true)
    expect(isRetryable({ code: '40001' })).toBe(true)
  })

  it('does not retry what would fail the same way', () => {
    expect(isRetryable(new PermanentError('no key'))).toBe(false)
    expect(isRetryable(new RefusalError('cyber'))).toBe(false)
    expect(isRetryable(new InvalidOutputError('bad'))).toBe(false)
    expect(isRetryable({ code: 'P0001', message: 'Media lists pull from an approved release.' })).toBe(false)
    expect(isRetryable({ code: '23505' })).toBe(false)
  })

  it('backs off 30s, 2m, 8m, then caps at 30m', () => {
    expect([1, 2, 3, 4, 9].map(backoffSeconds)).toEqual([30, 120, 480, 1800, 1800])
  })
})

describe('stats import totals', () => {
  it('sums numeric columns and skips text ones', () => {
    expect(
      totals([
        { Outlet: 'A', Views: '1,200', Pickups: '3' },
        { Outlet: 'B', Views: '800', Pickups: '' },
      ]),
    ).toEqual({ Views: 2000, Pickups: 3 })
  })
})

describe('section regenerate', () => {
  const current = { headline: 'H', sections: [{ id: 'a', body: 'old a' }, { id: 'b', body: 'old b' }] }

  it('replaces only the requested section', () => {
    const merged = mergeSection(current, { headline: 'changed', sections: [{ id: 'a', body: 'x' }, { id: 'b', body: 'new b' }] }, 'b')
    expect(merged).toEqual({ headline: 'H', sections: [{ id: 'a', body: 'old a' }, { id: 'b', body: 'new b' }] })
  })

  it('fails if the output lost the section', () => {
    expect(() => mergeSection(current, { sections: [] }, 'b')).toThrow(PermanentError)
  })
})

describe('slack', () => {
  it('escapes mrkdwn so email text cannot inject links or mentions', () => {
    expect(slackEscape('<!channel> & <https://evil|click>')).toBe('&lt;!channel&gt; &amp; &lt;https://evil|click&gt;')
  })

  it('mentions only well-formed Slack user ids', () => {
    expect(mention('U012ABCDEF', 'Liz')).toBe('<@U012ABCDEF>')
    expect(mention('<!here>', 'Liz')).toBe('Liz')
  })
})

describe('files', () => {
  it('detects readable types', () => {
    expect(kindOf('application/pdf', 'x')).toBe('pdf')
    expect(kindOf(null, 'Strategy.DOCX')).toBe('docx')
    expect(kindOf('text/plain', 'notes')).toBe('text')
    expect(kindOf('image/png', 'logo.png')).toBeNull()
  })

  it('strips html to text', () => {
    expect(htmlToText('<p>Hi&nbsp;there</p><script>x()</script><div>Bye &amp; out</div>')).toBe('Hi there\nBye & out')
  })

  it('makes safe filenames', () => {
    expect(safeFilename('../../Q4 results (final).pdf')).toBe('Q4-results-final.pdf')
  })
})
