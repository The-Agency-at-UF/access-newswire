/**
 * Client intake input. Parsed at the server-action boundary; the output is
 * shaped as an insert into `clients`.
 */

import { z } from 'zod'
import type { Enums } from '@access/db'

export const TIERS = ['L1', 'L2', 'L3'] as const satisfies readonly Enums<'tier'>[]

/** Blank form fields arrive as '' — store them as null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null)

/** People type bare domains; store a full https URL. */
const website = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => {
    if (!value) return null
    return /^https?:\/\//i.test(value) ? value : `https://${value}`
  })
  .pipe(z.url({ protocol: /^https?$/, hostname: z.regexes.domain }).nullable())

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  website,
  industry: optionalText(120),
  tier: z.enum(TIERS),
  release_cadence: optionalText(60),
  owner_id: z
    .union([z.literal(''), z.uuid()])
    .optional()
    .transform((value) => value || null),
})

export type ClientInput = z.output<typeof clientInputSchema>
