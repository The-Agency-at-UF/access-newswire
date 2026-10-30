/**
 * One-way alerts to a Slack channel via an incoming webhook (decided
 * 2026-10-20). The webhook only posts; nothing in Slack can trigger the app.
 */

/** Escape text for Slack mrkdwn, so email content can't inject links or mentions. */
export function slackEscape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function mention(slackUserId: string | null | undefined, fallbackName: string): string {
  return slackUserId && /^[UW][A-Z0-9]+$/.test(slackUserId) ? `<@${slackUserId}>` : slackEscape(fallbackName)
}

export async function postAlert(
  webhookUrl: string | undefined,
  text: string,
  log: (message: string, extra?: Record<string, unknown>) => void,
): Promise<boolean> {
  if (!webhookUrl) {
    log('slack alert (SLACK_WEBHOOK_URL not set)', { text })
    return false
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, unfurl_links: false, unfurl_media: false }),
  })
  if (!response.ok) throw new Error(`Slack ${response.status}: ${await response.text()}`)
  return true
}
