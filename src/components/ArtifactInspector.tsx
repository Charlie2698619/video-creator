import { getVideoArtifactPaths } from '../domain/artifacts'
import type { VideoProject } from '../domain/video'
import { getWorkflowBlockers } from '../domain/workflow'

type ArtifactInspectorProps = {
  project: VideoProject | null
  error: string | null
  pending: string | null
}

export function ArtifactInspector({ project, error, pending }: ArtifactInspectorProps) {
  const paths = project ? getVideoArtifactPaths(project.id) : null
  const blockers = project ? getWorkflowBlockers(project) : []

  return (
    <aside className="artifact-inspector" aria-label="Artifact inspector">
      <h2>Artifacts</h2>
      {pending ? <p className="pending-note">{pending}</p> : null}
      {error ? <p className="danger-note">{error}</p> : null}
      {!project || !paths ? (
        <p>No active video yet.</p>
      ) : (
        <>
          <dl>
            <div>
              <dt>Project</dt>
              <dd>{project.id}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{project.artifacts.sourceBundle?.manifestPath ?? paths.hyperframes}</dd>
            </div>
            <div>
              <dt>Narration</dt>
              <dd>{project.narration?.audioPath ?? project.narration?.scriptPath ?? paths.narrationAudio}</dd>
            </div>
            <div>
              <dt>MP4</dt>
              <dd>{project.artifacts.renderResult?.mp4Path ?? paths.renders}</dd>
            </div>
            <div>
              <dt>Thumbnail</dt>
              <dd>{project.artifacts.thumbnail?.path ?? paths.thumbnails}</dd>
            </div>
            <div>
              <dt>Metadata</dt>
              <dd>{project.artifacts.metadataPath ?? paths.metadata}</dd>
            </div>
            <div>
              <dt>Review</dt>
              <dd>{project.artifacts.reviewChecklistPath ?? paths.reviewChecklist}</dd>
            </div>
          </dl>
          {blockers.length ? (
            <ul className="blocker-list">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </aside>
  )
}
