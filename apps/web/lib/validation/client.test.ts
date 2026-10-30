import { describe, expect, it } from 'vitest'
import { clientInputSchema } from './client'

describe('clientInputSchema', () => {
  it('trims fields and turns blanks into null', () => {
    const parsed = clientInputSchema.parse({
      name: '  Ridgeline Minerals ',
      website: '',
      industry: ' ',
      tier: 'L2',
      release_cadence: '',
      owner_id: '',
    })
    expect(parsed).toEqual({
      name: 'Ridgeline Minerals',
      website: null,
      industry: null,
      tier: 'L2',
      release_cadence: null,
      owner_id: null,
    })
  })

  it('adds https to a bare domain', () => {
    const parsed = clientInputSchema.parse({ name: 'R', tier: 'L1', website: 'ridgeline.example' })
    expect(parsed.website).toBe('https://ridgeline.example')
  })

  it('keeps an explicit http(s) URL', () => {
    const parsed = clientInputSchema.parse({ name: 'R', tier: 'L1', website: 'http://ridgeline.example/about' })
    expect(parsed.website).toBe('http://ridgeline.example/about')
  })

  it('rejects a website that is not a URL', () => {
    expect(clientInputSchema.safeParse({ name: 'R', tier: 'L1', website: 'not a site' }).success).toBe(false)
  })

  it('requires a name', () => {
    expect(clientInputSchema.safeParse({ name: '   ', tier: 'L1' }).success).toBe(false)
  })

  it('rejects an unknown tier', () => {
    expect(clientInputSchema.safeParse({ name: 'R', tier: 'L4' }).success).toBe(false)
  })

  it('accepts an owner uuid and rejects anything else', () => {
    const owner = '0b6f8a2e-4c1d-4e6b-9a7f-3d2c1b0a9e8f'
    expect(clientInputSchema.parse({ name: 'R', tier: 'L1', owner_id: owner }).owner_id).toBe(owner)
    expect(clientInputSchema.safeParse({ name: 'R', tier: 'L1', owner_id: 'liz' }).success).toBe(false)
  })
})
