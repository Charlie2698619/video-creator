import { z } from 'zod'

export const videoStatuses = [
  'idea',
  'storyboard',
  'scene_plan',
  'source_ready',
  'rendered',
  'library_ready',
  'needs_review',
  'reviewed',
  'failed',
] as const

export type VideoStatus = (typeof videoStatuses)[number]

export const ideaInputSchema = z.object({
  title: z.string().trim().min(1, 'Working title is required.'),
  summary: z.string().trim().min(1, 'Idea summary is required.'),
  takeaway: z.string().trim().min(1, 'Viewer takeaway is required.'),
  references: z.array(z.string().trim()).default([]),
  targetDurationSeconds: z.number().int().min(5).max(120).default(30),
})

export type IdeaInput = z.input<typeof ideaInputSchema>
export type Idea = z.output<typeof ideaInputSchema>

export type Storyboard = {
  hook: string
  beats: string[]
  ending: string
  tone: string
}

export type ScenePlanScene = {
  sceneNumber: number
  durationSeconds: number
  visualDirection: string
  onScreenText: string
  motionNotes: string
  audioNotes: string
  acceptanceCriteria: string[]
}

export type ScenePlan = {
  scenes: ScenePlanScene[]
  totalDurationSeconds: number
}

export type SourceBundle = {
  sourceFolder: string
  entryFile: string
  manifestPath: string
  status: 'source_ready' | 'source_failed'
}

export type RenderResult = {
  mp4Path: string
  width: number
  height: number
  durationSeconds: number
  fps: number
  checksum: string
  logPath: string
  status: 'rendered' | 'failed'
}

export type Thumbnail = {
  path: string
  width: number
  height: number
  checksum: string
}

export type ReviewChecklist = {
  mp4Exists: boolean
  aspectRatioIsPortrait: boolean
  durationMatchesPlan: boolean
  textReadable: boolean
  thumbnailExists: boolean
  metadataValid: boolean
  sourcePreserved: boolean
  noFailedArtifactMarkedComplete: boolean
  humanDecision: 'pending' | 'approved' | 'rejected'
  reviewedAt: string | null
}

export type VideoProject = {
  id: string
  title: string
  status: VideoStatus
  createdAt: string
  updatedAt: string
  idea: Idea
  storyboard: Storyboard | null
  scenePlan: ScenePlan | null
  artifacts: {
    sourceBundle: SourceBundle | null
    renderResult: RenderResult | null
    thumbnail: Thumbnail | null
    metadataPath: string | null
    reviewChecklistPath: string | null
  }
  reviewChecklist: ReviewChecklist | null
  failure: { stage: VideoStatus; message: string } | null
}

export function createVideoProject(input: IdeaInput, nowIso: string): VideoProject {
  const idea = ideaInputSchema.parse(input)
  const id = `video-${nowIso.replaceAll(/[^0-9]/g, '').slice(0, 14)}`

  return {
    id,
    title: idea.title,
    status: 'idea',
    createdAt: nowIso,
    updatedAt: nowIso,
    idea,
    storyboard: null,
    scenePlan: null,
    artifacts: {
      sourceBundle: null,
      renderResult: null,
      thumbnail: null,
      metadataPath: null,
      reviewChecklistPath: null,
    },
    reviewChecklist: null,
    failure: null,
  }
}
