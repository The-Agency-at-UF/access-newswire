import Link from 'next/link'
import type { PipelineNode } from '@/lib/selectors/stages'

/**
 * A stage rail. Each node links to the stage it represents; connector segments
 * are solid up to the current stage so progress reads at a glance.
 */
export function Pipeline({
  nodes,
  clientId,
  label,
}: {
  nodes: readonly PipelineNode[]
  clientId: string
  label: string
}) {
  return (
    <div className="rail" role="list" aria-label={label}>
      {nodes.map((node) => (
        <div className="railItem" role="listitem" key={node.key}>
          <span className={`railLine railLine--${node.lineBefore}`} />
          <Link
            href={`/clients/${clientId}/${node.tab}`}
            className={`railNode railNode--${node.state}`}
          >
            <span className="railMark">{node.mark}</span>
            <span className="railLabel">{node.label}</span>
            <span className="railStatus">{node.statusText}</span>
          </Link>
          <span className={`railLine railLine--${node.lineAfter}`} />
        </div>
      ))}
    </div>
  )
}
