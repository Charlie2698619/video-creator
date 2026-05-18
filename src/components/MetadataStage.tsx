import type { VideoProject } from '../domain/video'
import { StatusBadge } from './StatusBadge'

type MetadataStageProps = {
  project: VideoProject | null
  onThumbnail: () => Promise<void>
  onMetadata: () => Promise<void>
  disabled: boolean
}

export function MetadataStage({ project, onThumbnail, onMetadata, disabled }: MetadataStageProps) {
  return (
    <section className="stage-panel" aria-labelledby="metadata-stage">
      <div className="stage-heading">
        <p>Stage 6</p>
        <h2 id="metadata-stage">Thumbnail + Metadata</h2>
      </div>
      <div className="action-row">
        <button className="secondary-action" type="button" onClick={onThumbnail} disabled={disabled || !project?.artifacts.renderResult}>
          Create thumbnail
        </button>
        <button className="primary-action" type="button" onClick={onMetadata} disabled={disabled || !project?.artifacts.thumbnail}>
          Write metadata JSON
        </button>
      </div>
      {project?.artifacts.metadataPath ? <StatusBadge label="Metadata ready" tone="ready" /> : <StatusBadge label="Render required" />}
    </section>
  )
}
