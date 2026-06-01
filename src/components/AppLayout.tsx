import { useState } from 'react'
import { videoApi } from '../api/videoApi'
import type { GenerationSettings, VideoProject } from '../domain/video'
import { ArtifactInspector } from './ArtifactInspector'
import { IdeaStage } from './IdeaStage'
import { MediaLibrary } from './MediaLibrary'
import { MetadataStage } from './MetadataStage'
import { NarrationStage } from './NarrationStage'
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
  loadingProjects: boolean
  onError: (message: string | null) => void
  onProjectChanged: (project: VideoProject) => void
}

type PendingAction = {
  stage: string
  label: string
}

type BriefInput = {
  title: string
  summary: string
  takeaway: string
  references: string[]
  targetDurationSeconds: number
  generationSettings: GenerationSettings
}

const workflowStages = [
  { key: 'idea', label: 'Idea' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'scene_plan', label: 'Scene Plan' },
  { key: 'narration', label: 'Narration' },
  { key: 'source', label: 'Source' },
  { key: 'render', label: 'Render' },
  { key: 'metadata', label: 'Metadata' },
  { key: 'library', label: 'Library' },
  { key: 'review', label: 'Review' },
]

export function AppLayout({ activeProject, projects, error, loadingProjects, onError, onProjectChanged }: AppLayoutProps) {
  const [pending, setPending] = useState<PendingAction | null>(null)

  async function runAction(stage: string, label: string, action: () => Promise<VideoProject>) {
    setPending({ stage, label })
    onError(null)
    try {
      onProjectChanged(await action())
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Action failed.')
    } finally {
      setPending(null)
    }
  }

  async function runDraft(input: BriefInput) {
    setPending({ stage: 'draft', label: 'Saving brief...' })
    onError(null)
    try {
      let project = (await videoApi.createProject(input)).project
      onProjectChanged(project)
      const steps: Array<{ label: string; action: (videoId: string) => Promise<VideoProject> }> = [
        { label: 'Creating storyboard...', action: async (videoId) => (await videoApi.runCodexStage(videoId, 'storyboard')).project },
        { label: 'Creating scene plan...', action: async (videoId) => (await videoApi.runCodexStage(videoId, 'scene_plan')).project },
        { label: 'Writing narration script...', action: async (videoId) => (await videoApi.runCodexStage(videoId, 'narration')).project },
        { label: 'Generating AI voiceover...', action: async (videoId) => (await videoApi.generateNarrationAudio(videoId)).project },
        { label: 'Building video source...', action: async (videoId) => (await videoApi.runCodexStage(videoId, 'source')).project },
        { label: 'Rendering MP4...', action: async (videoId) => (await videoApi.render(videoId)).project },
        { label: 'Creating thumbnail...', action: async (videoId) => (await videoApi.thumbnail(videoId)).project },
        { label: 'Writing metadata...', action: async (videoId) => (await videoApi.metadata(videoId)).project },
      ]

      for (const step of steps) {
        setPending({ stage: 'draft', label: step.label })
        project = await step.action(project.id)
        onProjectChanged(project)
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Draft generation failed.')
    } finally {
      setPending(null)
    }
  }

  const disabled = Boolean(pending) || loadingProjects
  const pendingLabelFor = (...stages: string[]) => (pending && stages.includes(pending.stage) ? pending.label : null)

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Local-first video workflow</p>
          <h1>Video Creator</h1>
        </div>
        <StatusBadge label={activeProject?.status === 'reviewed' ? 'complete' : (activeProject?.status ?? 'no project')} tone={activeProject?.status === 'reviewed' ? 'ready' : 'neutral'} />
      </header>
      {loadingProjects || pending ? (
        <div className="operation-progress" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          {pending?.label ?? 'Loading saved projects...'}
        </div>
      ) : null}
      <nav className="workflow-rail" aria-label="Video workflow">
        {workflowStages.map((stage) => (
          <span key={stage.key} className={pending?.stage === stage.key ? 'is-active' : undefined} aria-current={pending?.stage === stage.key ? 'step' : undefined}>
            {stage.label}
          </span>
        ))}
      </nav>
      <section className="workspace-grid">
        <div className="stage-stack">
          <IdeaStage
            disabled={disabled}
            pendingLabel={pendingLabelFor('idea', 'draft')}
            onSave={(input) => runAction('idea', 'Saving idea...', async () => (await videoApi.createProject(input)).project)}
            onGenerateDraft={runDraft}
          />
          <StoryboardStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('storyboard')}
            onCreate={() => runAction('storyboard', 'Creating storyboard...', async () => (await videoApi.runCodexStage(activeProject!.id, 'storyboard')).project)}
          />
          <ScenePlanStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('scene_plan')}
            onCreate={() => runAction('scene_plan', 'Creating scene plan...', async () => (await videoApi.runCodexStage(activeProject!.id, 'scene_plan')).project)}
          />
          <NarrationStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('narration')}
            onCreateScript={() => runAction('narration', 'Creating narration script...', async () => (await videoApi.runCodexStage(activeProject!.id, 'narration')).project)}
            onGenerateAudio={() => runAction('narration', 'Generating AI voiceover...', async () => (await videoApi.generateNarrationAudio(activeProject!.id)).project)}
          />
          <SourceStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('source')}
            onCreate={() => runAction('source', 'Building video source...', async () => (await videoApi.runCodexStage(activeProject!.id, 'source')).project)}
          />
          <RenderStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('render')}
            onRender={() => runAction('render', 'Rendering MP4...', async () => (await videoApi.render(activeProject!.id)).project)}
          />
          <MetadataStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('metadata')}
            onThumbnail={() => runAction('metadata', 'Creating thumbnail...', async () => (await videoApi.thumbnail(activeProject!.id)).project)}
            onMetadata={() => runAction('metadata', 'Writing metadata...', async () => (await videoApi.metadata(activeProject!.id)).project)}
          />
          <ReviewStage
            project={activeProject}
            disabled={disabled}
            pendingLabel={pendingLabelFor('review')}
            onReview={(input) => runAction('review', input.humanDecision === 'approved' ? 'Approving review...' : 'Rejecting review...', async () => (await videoApi.review(activeProject!.id, input)).project)}
          />
          <MediaLibrary projects={projects} />
        </div>
        <ArtifactInspector project={activeProject} error={error} pending={pending?.label ?? (loadingProjects ? 'Loading saved projects...' : null)} />
      </section>
    </main>
  )
}
