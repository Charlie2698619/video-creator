import { useState } from 'react'
import { videoApi } from '../api/videoApi'
import type { VideoProject } from '../domain/video'
import { ArtifactInspector } from './ArtifactInspector'
import { IdeaStage } from './IdeaStage'
import { MediaLibrary } from './MediaLibrary'
import { MetadataStage } from './MetadataStage'
import { RenderStage } from './RenderStage'
import { ReviewStage } from './ReviewStage'
import { ScenePlanStage } from './ScenePlanStage'
import { SourceStage } from './SourceStage'
import { StatusBadge } from './StatusBadge'
import { StoryboardStage } from './StoryboardStage'

type AppLayoutProps = {
  activeProject: VideoProject | null
  projects: VideoProject[]
  error: string | null
  onError: (message: string | null) => void
  onProjectChanged: (project: VideoProject) => void
}

export function AppLayout({ activeProject, projects, error, onError, onProjectChanged }: AppLayoutProps) {
  const [pending, setPending] = useState<string | null>(null)

  async function runAction(label: string, action: () => Promise<VideoProject>) {
    setPending(label)
    onError(null)
    try {
      onProjectChanged(await action())
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Action failed.')
    } finally {
      setPending(null)
    }
  }

  const disabled = Boolean(pending)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first video workflow</p>
          <h1>Video Creator</h1>
        </div>
        <StatusBadge label={activeProject?.status === 'reviewed' ? 'complete' : (activeProject?.status ?? 'no project')} tone={activeProject?.status === 'reviewed' ? 'ready' : 'neutral'} />
      </header>
      <nav className="workflow-rail" aria-label="Video workflow">
        {['Idea', 'Storyboard', 'Scene Plan', 'Source', 'Render', 'Metadata', 'Library', 'Review'].map((stage) => (
          <span key={stage}>{stage}</span>
        ))}
      </nav>
      <section className="workspace-grid">
        <div className="stage-stack">
          <IdeaStage
            disabled={disabled}
            onSave={(input) => runAction('Saving idea...', async () => (await videoApi.createProject(input)).project)}
          />
          <StoryboardStage
            project={activeProject}
            disabled={disabled}
            onCreate={() => runAction('Creating storyboard...', async () => (await videoApi.runCodexStage(activeProject!.id, 'storyboard')).project)}
          />
          <ScenePlanStage
            project={activeProject}
            disabled={disabled}
            onCreate={() => runAction('Creating scene plan...', async () => (await videoApi.runCodexStage(activeProject!.id, 'scene_plan')).project)}
          />
          <SourceStage
            project={activeProject}
            disabled={disabled}
            onCreate={() => runAction('Creating HyperFrames source...', async () => (await videoApi.runCodexStage(activeProject!.id, 'source')).project)}
          />
          <RenderStage project={activeProject} disabled={disabled} onRender={() => runAction('Rendering MP4...', async () => (await videoApi.render(activeProject!.id)).project)} />
          <MetadataStage
            project={activeProject}
            disabled={disabled}
            onThumbnail={() => runAction('Creating thumbnail...', async () => (await videoApi.thumbnail(activeProject!.id)).project)}
            onMetadata={() => runAction('Writing metadata...', async () => (await videoApi.metadata(activeProject!.id)).project)}
          />
          <ReviewStage project={activeProject} disabled={disabled} onReview={() => runAction('Checking review...', async () => (await videoApi.review(activeProject!.id)).project)} />
          <MediaLibrary projects={projects} />
        </div>
        <ArtifactInspector project={activeProject} error={error} pending={pending} />
      </section>
    </main>
  )
}
