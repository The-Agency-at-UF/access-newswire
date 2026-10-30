import type { TaskContext } from '../context'
import { PermanentError } from './errors'

export async function download(ctx: TaskContext, bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await ctx.storage.storage.from(bucket).download(path)
  if (error || !data) throw new Error(`download ${bucket}/${path} failed: ${error?.message ?? 'no data'}`)
  return new Uint8Array(await data.arrayBuffer())
}

export async function upload(ctx: TaskContext, bucket: string, path: string, bytes: Uint8Array, contentType: string) {
  if (!path.startsWith(`${ctx.job.org_id}/`)) throw new PermanentError(`refusing to write outside the org folder: ${path}`)
  const { error } = await ctx.storage.storage.from(bucket).upload(path, bytes, { contentType, upsert: true })
  if (error) throw new Error(`upload ${bucket}/${path} failed: ${error.message}`)
}

/** A filename that's safe as one storage path segment. */
export function safeFilename(name: string): string {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').replace(/^\.+/, '')
  return cleaned.slice(-120) || 'file'
}
