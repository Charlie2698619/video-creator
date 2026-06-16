import type { z } from 'zod'

export declare const videoStatuses: readonly [
  'idea',
  'format_strategy',
  'storyboard',
  'scene_plan',
  'narration_script',
  'narration_ready',
  'source_ready',
  'rendered',
  'library_ready',
  'needs_review',
  'reviewed',
  'failed',
]

export type VideoStatus = (typeof videoStatuses)[number]

export declare const formatTypes: readonly ['programmatic_explainer', 'multi_image_story']
export declare const syncPriorities: readonly ['medium', 'high']

export type FormatType = (typeof formatTypes)[number]
export type SyncPriority = (typeof syncPriorities)[number]

export type RiskFlags = {
  publicFigure: boolean
  syntheticVoice: boolean
  aiMusic: boolean
  realisticSyntheticScene: boolean
}

export type GenerationSettings = {
  durationMode: 'voice_led' | 'fixed'
  visualComplexity: 'standard' | 'rich'
  pacing: 'calm' | 'natural' | 'fast'
  captions: 'burned_in' | 'off'
  audioMix: 'voice_only' | 'soft_music'
}

type GenerationSettingsInput = Partial<GenerationSettings>

export type IdeaInput = {
  title: string
  summary: string
  takeaway: string
  references?: string[]
  targetDurationSeconds?: number
  generationSettings?: GenerationSettingsInput
}

export type Idea = {
  title: string
  summary: string
  takeaway: string
  references: string[]
  targetDurationSeconds: number
  generationSettings: GenerationSettings
}

export type FormatStrategyInput = {
  formatType: FormatType
  contentMoat: string
  visualSystem: string
  syncPriority?: SyncPriority
  riskFlags?: Partial<RiskFlags>
}

export type FormatStrategy = {
  formatType: FormatType
  contentMoat: string
  visualSystem: string
  syncPriority: SyncPriority
  riskFlags: RiskFlags
  policyNotes: string[]
}

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

export type Narration = {
  scriptPath: string
  audioPath: string | null
  voice: string
  durationSeconds: number
  status: 'script_ready' | 'audio_ready'
}

export type SourceBundle = {
  sourceFolder: string
  entryFile: string
  manifestPath: string
  origin: 'codex' | 'fallback'
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
  mp4HasAudioStream: boolean
  aspectRatioIsPortrait: boolean
  durationMatchesPlan: boolean
  textReadable: boolean
  thumbnailExists: boolean
  metadataValid: boolean
  narrationAudioExists: boolean
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
  formatStrategy: FormatStrategy | null
  storyboard: Storyboard | null
  scenePlan: ScenePlan | null
  narration: Narration | null
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

export declare const defaultGenerationSettings: Readonly<GenerationSettings>
export declare const defaultRiskFlags: Readonly<RiskFlags>
export declare const generationSettingsSchema: z.ZodType<GenerationSettings, GenerationSettingsInput | undefined>
export declare const formatStrategyInputSchema: z.ZodType<FormatStrategyInput>
export declare const projectInputSchema: z.ZodType<Idea, IdeaInput>
export declare const ideaInputSchema: typeof projectInputSchema

export declare function normalizeFormatStrategy(input: FormatStrategyInput): FormatStrategy
export declare function createVideoProject(input: IdeaInput, nowIso: string): VideoProject
