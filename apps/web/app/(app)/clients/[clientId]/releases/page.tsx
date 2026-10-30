import { autoReleaseMode } from '@/lib/selectors/stages'
import { getWorkspace } from '@/lib/workspace'
import { StagePage } from '../StagePage'

/**
 * Press releases. L2 clients send their own draft and we suggest edits; L1 and
 * L3 releases we write. Needs an approved strategy and Meeting 2.
 */
export default async function ReleasesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const { client } = await getWorkspace(clientId)
  const weEdit = autoReleaseMode(client.tier) === 'B'

  return (
    <StagePage clientId={clientId} gate="releases" title="No releases yet">
      {weEdit
        ? 'The client sends each draft; suggested edits show here for review, and export with tracked changes.'
        : 'Each release is drafted from the approved strategy and roadmap, then reviewed here before export.'}
    </StagePage>
  )
}
