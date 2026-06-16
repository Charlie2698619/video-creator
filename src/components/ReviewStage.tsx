import { useState } from 'react'
import type { ReviewChecklist, VideoProject } from '../domain/video'
import { StageProgress } from './StageProgress'
import { StatusBadge } from './StatusBadge'

type ReviewStageProps = {
  project: VideoProject | null
  onReview: (input: { humanDecision: 'approved' | 'rejected'; textReadable: boolean }) => Promise<void>
  disabled: boolean
  pendingLabel: string | null
}

const checklistLabels: Array<{ key: keyof Omit<ReviewChecklist, 'humanDecision' | 'policyWarnings' | 'reviewedAt'>; label: string }> = [
  { key: 'mp4Exists', label: 'MP4 exists' },
  { key: 'mp4HasAudioStream', label: 'MP4 has audio' },
  { key: 'aspectRatioIsPortrait', label: 'Portrait aspect ratio' },
  { key: 'durationMatchesPlan', label: 'Duration matches policy' },
  { key: 'textReadable', label: 'Text readable' },
  { key: 'thumbnailExists', label: 'Thumbnail exists' },
  { key: 'metadataValid', label: 'Metadata valid' },
  { key: 'narrationAudioExists', label: 'Narration audio exists' },
  { key: 'sourcePreserved', label: 'Source preserved' },
  { key: 'noFailedArtifactMarkedComplete', label: 'No failed artifact marked complete' },
]

export function ReviewStage({ project, onReview, disabled, pendingLabel }: ReviewStageProps) {
  const [textReadable, setTextReadable] = useState(false)
  const canReview = Boolean(project?.artifacts.metadataPath)
  const reviewChecklist = project?.reviewChecklist

  return (
    <section className="stage-panel review-checklist" aria-labelledby="review-stage">
      <div className="stage-heading">
        <p>Stage 9</p>
        <h2 id="review-stage">Review Checklist</h2>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={textReadable} onChange={(event) => setTextReadable(event.target.checked)} disabled={disabled || !canReview} />
        <span>On-screen text is readable</span>
      </label>
      <div className="action-row">
        <button className="primary-action" type="button" onClick={() => onReview({ humanDecision: 'approved', textReadable })} disabled={disabled || !canReview || !textReadable}>
          Approve review
        </button>
        <button className="secondary-action" type="button" onClick={() => onReview({ humanDecision: 'rejected', textReadable })} disabled={disabled || !canReview}>
          Reject review
        </button>
      </div>
      <StageProgress label={pendingLabel} />
      {reviewChecklist ? (
        <ul className="checklist-results" aria-label="Review checklist results">
          {checklistLabels.map((item) => (
            <li key={item.key} data-state={reviewChecklist[item.key] ? 'pass' : 'fail'}>
              <span>{item.label}</span>
              <strong>{reviewChecklist[item.key] ? 'Pass' : 'Fail'}</strong>
            </li>
          ))}
          <li data-state={reviewChecklist.humanDecision === 'approved' ? 'pass' : 'fail'}>
            <span>Human decision</span>
            <strong>{reviewChecklist.humanDecision}</strong>
          </li>
        </ul>
      ) : null}
      {reviewChecklist?.policyWarnings?.length ? (
        <ul className="policy-warning-list" aria-label="Policy warnings">
          {reviewChecklist.policyWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {project?.status === 'reviewed' ? (
        <StatusBadge label="Reviewed" tone="ready" />
      ) : project?.status === 'needs_review' ? (
        <StatusBadge label="Needs review" tone="blocked" />
      ) : (
        <StatusBadge label="Metadata required" />
      )}
    </section>
  )
}
