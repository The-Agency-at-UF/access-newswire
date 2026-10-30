/**
 * Uploads go through a server action, and Vercel caps a request body at
 * 4.5 MB, so app uploads stay under 4 MB. Inbox attachments (up to 25 MB) are
 * stored by the worker and don't pass through here. Keep `bodySizeLimit` in
 * `next.config.ts` just above this.
 */
export const MAX_UPLOAD_MB = 4
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
