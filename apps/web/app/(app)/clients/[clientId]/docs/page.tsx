import { StagePage } from '../StagePage'

/** The client's indexed documents. */
export default async function DocsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return (
    <StagePage clientId={clientId} title="No documents yet">
      Uploads, inbox attachments and generated files for this client, indexed for search.
    </StagePage>
  )
}
