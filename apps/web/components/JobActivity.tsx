'use client'

import { useActionState } from 'react'
import type { Enums } from '@access/db'
import { cancelJobAction } from '@/app/(app)/job-actions'
import { StatusPill } from '@/components/ui/badges'
import { isActive, jobLabel } from '@/lib/jobs'
import { JOB_STATUS } from '@/lib/tokens'

export interface JobRow {
  id: string
  type: string
  status: Enums<'job_status'>
  progress: number
  progress_message: string | null
  error: string | null
  created_at: string
}

const at = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function CancelButton({ jobId }: { jobId: string }) {
  const [result, formAction, pending] = useActionState(cancelJobAction, null)
  return (
    <form action={formAction} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="job_id" value={jobId} />
      <button type="submit" className="btn btn--xs btn--quiet" disabled={pending}>
        {pending ? '…' : 'Cancel'}
      </button>
      {result && !result.ok && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{result.message}</span>}
    </form>
  )
}

/**
 * Background work for a client, newest first. Rendered by a server page that
 * also mounts `LiveRefresh` on `jobs`, so progress moves without a reload.
 */
export function JobActivity({ jobs }: { jobs: JobRow[] }) {
  if (jobs.length === 0) return <span className="hint hint--muted">Nothing running.</span>

  return (
    <div className="stack" style={{ gap: 12 }}>
      {jobs.map((job) => (
        <div key={job.id} className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="cellStrong" style={{ flex: 1 }}>
              {jobLabel(job.type)}
            </span>
            <StatusPill badge={JOB_STATUS[job.status]} />
            {isActive(job.status) && <CancelButton jobId={job.id} />}
          </div>
          {job.status === 'running' && (
            <div className="row" style={{ gap: 10 }}>
              <div className="bar" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="barFill" style={{ width: `${job.progress}%` }} />
              </div>
              <span className="cellMono">{job.progress}%</span>
            </div>
          )}
          <span className="note" style={job.status === 'failed' ? { color: 'var(--danger)' } : undefined}>
            {job.status === 'failed' ? job.error : job.progress_message ?? at.format(new Date(job.created_at))}
          </span>
        </div>
      ))}
    </div>
  )
}
