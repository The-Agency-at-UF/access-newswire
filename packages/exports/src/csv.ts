/**
 * Media list → CSV for the manual ACCESS upload (AGENTS.md §13). Columns come
 * from org_settings.access_csv_columns, since ACCESS's exact format is still
 * open (§16).
 */

export interface CsvColumn {
  header: string
  field: string
}

export interface MediaListRow {
  name: string
  email: string | null
  title: string | null
  outlet: string | null
  beats: string[]
  relevance_reason: string | null
}

/** Field values a column can name. */
export function mediaListFields(row: MediaListRow): Record<string, string> {
  const [first, ...rest] = row.name.trim().split(/\s+/)
  return {
    name: row.name,
    first_name: first ?? '',
    last_name: rest.join(' '),
    email: row.email ?? '',
    title: row.title ?? '',
    outlet: row.outlet ?? '',
    beats: row.beats.join('; '),
    relevance_reason: row.relevance_reason ?? '',
  }
}

/**
 * One RFC 4180 cell. Values that a spreadsheet would run as a formula
 * (=, +, -, @, tab, CR) are prefixed with a quote mark so they stay text.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

export function renderMediaListCsv(rows: MediaListRow[], columns: CsvColumn[]): string {
  const lines = [columns.map((column) => csvCell(column.header)).join(',')]
  for (const row of rows) {
    const fields = mediaListFields(row)
    lines.push(columns.map((column) => csvCell(fields[column.field] ?? '')).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}
