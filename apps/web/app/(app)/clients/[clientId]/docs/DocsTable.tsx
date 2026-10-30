'use client'

import { useState } from 'react'
import type { Enums } from '@access/db'
import { StatusPill } from '@/components/ui/badges'
import { FilterChip } from '@/components/ui/controls'
import { DOC_SOURCES, INDEX_STATUS } from '@/lib/tokens'

export interface DocRow {
  id: string
  title: string
  source: Enums<'document_source'>
  index_status: Enums<'index_status'>
  index_error: string | null
  size_bytes: number | null
  created_at: string
  /** Short-lived signed download link, when one could be made. */
  href: string | null
}

const added = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function size(bytes: number | null): string {
  if (!bytes) return '—'
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** The client's documents, filterable by where they came from. */
export function DocsTable({ docs }: { docs: DocRow[] }) {
  const [source, setSource] = useState<Enums<'document_source'> | null>(null)
  const present = (Object.keys(DOC_SOURCES) as Enums<'document_source'>[]).filter((s) => docs.some((d) => d.source === s))
  const rows = source ? docs.filter((d) => d.source === source) : docs

  return (
    <>
      {present.length > 1 && (
        <div className="row" style={{ gap: 6, padding: '12px 20px 0' }}>
          <FilterChip active={source === null} onClick={() => setSource(null)}>
            All
          </FilterChip>
          {present.map((s) => (
            <FilterChip key={s} active={source === s} onClick={() => setSource(s)}>
              {DOC_SOURCES[s]}
            </FilterChip>
          ))}
        </div>
      )}
      <div className="card--scroll">
        <div className="tHead t-docs">
          <span>Document</span>
          <span>Source</span>
          <span>Index</span>
          <span>Size</span>
        </div>
        {rows.map((doc) => (
          <div key={doc.id} className="tRow t-docs">
            <span className="cellStack">
              {doc.href ? (
                <a className="cellStrong" href={doc.href} target="_blank" rel="noreferrer">
                  {doc.title}
                </a>
              ) : (
                <span className="cellStrong">{doc.title}</span>
              )}
              <span className="note">{doc.index_error ?? `Added ${added.format(new Date(doc.created_at))}`}</span>
            </span>
            <span>{DOC_SOURCES[doc.source]}</span>
            <StatusPill badge={INDEX_STATUS[doc.index_status]} />
            <span className="cellMono">{size(doc.size_bytes)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
