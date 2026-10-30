/**
 * Microsoft Graph, read-only (AGENTS.md §12): app-only auth with the
 * Mail.Read application permission, which a tenant admin grants and should
 * scope to the shared mailbox with an application access policy.
 */

import type { Env } from '../env'
import { PermanentError } from './errors'

const GRAPH = 'https://graph.microsoft.com/v1.0'
// Outlook message subscriptions last at most ~3 days; renew well before that.
const SUBSCRIPTION_MINUTES = 4200

export interface GraphMessage {
  id: string
  subject: string | null
  from?: { emailAddress?: { address?: string; name?: string } }
  toRecipients?: { emailAddress?: { address?: string } }[]
  ccRecipients?: { emailAddress?: { address?: string } }[]
  body?: { contentType?: string; content?: string }
  receivedDateTime?: string
  conversationId?: string
  internetMessageId?: string
  hasAttachments?: boolean
}

export interface GraphAttachmentMeta {
  id: string
  name: string
  contentType: string | null
  size: number
  isInline: boolean
  '@odata.type': string
}

export class GraphClient {
  private token: { value: string; expiresAt: number } | null = null

  constructor(private readonly env: Env) {
    if (!env.MS_GRAPH_TENANT_ID || !env.MS_GRAPH_CLIENT_ID || !env.MS_GRAPH_CLIENT_SECRET) {
      throw new PermanentError('Microsoft Graph is not configured (MS_GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET).')
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value
    const response = await fetch(`https://login.microsoftonline.com/${this.env.MS_GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.env.MS_GRAPH_CLIENT_ID!,
        client_secret: this.env.MS_GRAPH_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    })
    if (!response.ok) throw new Error(`Graph token ${response.status}: ${await response.text()}`)
    const json = (await response.json()) as { access_token: string; expires_in: number }
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
    return json.access_token
  }

  async request<T>(pathOrUrl: string, init: RequestInit & { prefer?: string[] } = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${await this.accessToken()}`)
    if (init.prefer?.length) headers.set('prefer', init.prefer.join(', '))
    if (init.body) headers.set('content-type', 'application/json')
    const response = await fetch(pathOrUrl.startsWith('https://') ? pathOrUrl : `${GRAPH}${pathOrUrl}`, { ...init, headers })
    if (response.status === 404) throw new GraphNotFound(pathOrUrl)
    if (!response.ok) throw new Error(`Graph ${response.status} ${pathOrUrl}: ${(await response.text()).slice(0, 500)}`)
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async bytes(path: string): Promise<Uint8Array> {
    const response = await fetch(`${GRAPH}${path}`, { headers: { authorization: `Bearer ${await this.accessToken()}` } })
    if (!response.ok) throw new Error(`Graph ${response.status} ${path}`)
    return new Uint8Array(await response.arrayBuffer())
  }

  // ------------------------------------------------------------ subscriptions

  createSubscription(mailbox: string, notificationUrl: string, clientState: string) {
    return this.request<{ id: string; expirationDateTime: string }>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl,
        resource: `users/${mailbox}/mailFolders('Inbox')/messages`,
        expirationDateTime: expiry(),
        clientState,
      }),
    })
  }

  renewSubscription(id: string) {
    return this.request<{ id: string; expirationDateTime: string }>(`/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ expirationDateTime: expiry() }),
    })
  }

  // ------------------------------------------------------------ messages

  /**
   * One page of Inbox changes. Start with no link (and a cutoff for the first
   * sync); then follow `@odata.nextLink`, and save `@odata.deltaLink` for next time.
   */
  delta(mailbox: string, link: string | null, since: Date) {
    const first =
      `/users/${encodeURIComponent(mailbox)}/mailFolders('Inbox')/messages/delta` +
      `?$select=id,receivedDateTime&$filter=receivedDateTime+ge+${since.toISOString()}`
    return this.request<{
      value: ({ id: string } & { '@removed'?: unknown })[]
      '@odata.nextLink'?: string
      '@odata.deltaLink'?: string
    }>(link ?? first, { prefer: ['odata.maxpagesize=50'] })
  }

  message(mailbox: string, id: string) {
    const select = 'id,subject,from,toRecipients,ccRecipients,body,receivedDateTime,conversationId,internetMessageId,hasAttachments'
    return this.request<GraphMessage>(`/users/${encodeURIComponent(mailbox)}/messages/${id}?$select=${select}`, {
      prefer: ['outlook.body-content-type="text"'],
    })
  }

  async attachments(mailbox: string, id: string): Promise<GraphAttachmentMeta[]> {
    const json = await this.request<{ value: GraphAttachmentMeta[] }>(
      `/users/${encodeURIComponent(mailbox)}/messages/${id}/attachments?$select=id,name,contentType,size,isInline`,
    )
    return json.value
  }

  attachmentBytes(mailbox: string, messageId: string, attachmentId: string) {
    return this.bytes(`/users/${encodeURIComponent(mailbox)}/messages/${messageId}/attachments/${attachmentId}/$value`)
  }
}

export class GraphNotFound extends Error {
  override name = 'GraphNotFound'
}

function expiry(): string {
  return new Date(Date.now() + SUBSCRIPTION_MINUTES * 60_000).toISOString()
}
