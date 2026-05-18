import type { VideoProject } from '../domain/video'
import { StatusBadge } from './StatusBadge'

type ReviewStageProps = {
  project: VideoProject | null
  onReview: () => Promise<void>
  disabled: boolean
}

export function ReviewStage({ project, onReview, disabled }: ReviewStageProps) {
  return (
    <section className="stage-panel review-checklist" aria-labelledby="review-stage">
      <div className="stage-heading">
        <p>Stage 8</p>
        <h2 id="review-stage">Review Checklist</h2>
      </div>
      <button className="primary-action" type="button" onClick={onReview} disabled={disabled || !project?.artifacts.metadataPath}>
        Approve review checklist
      </button>
      {project?.status === 'reviewed' ? <StatusBadge label="Reviewed" tone="ready" /> : <StatusBadge label="Needs review" />}
    </section>
  )
}
