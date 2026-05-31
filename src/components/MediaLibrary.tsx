import { isLibraryEligible } from '../domain/artifacts'
import type { VideoProject } from '../domain/video'
import { StatusBadge } from './StatusBadge'

type MediaLibraryProps = {
  projects: VideoProject[]
}

export function MediaLibrary({ projects }: MediaLibraryProps) {
  const libraryProjects = projects.filter(isLibraryEligible)

  return (
    <section className="media-library" aria-labelledby="media-library">
      <div className="stage-heading">
        <p>Stage 8</p>
        <h2 id="media-library">Media Library</h2>
      </div>
      {libraryProjects.length === 0 ? (
        <p>No library-ready media yet.</p>
      ) : (
        <ul>
          {libraryProjects.map((project) => (
            <li key={project.id}>
              <strong>{project.title}</strong>
              <StatusBadge label={project.status === 'reviewed' ? 'Final' : project.status} tone={project.status === 'reviewed' ? 'ready' : 'neutral'} />
              <span>{project.artifacts.renderResult?.mp4Path ?? project.artifacts.sourceBundle?.sourceFolder}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
