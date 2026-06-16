import { z } from 'zod'

export const videoStatuses = [
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

export const defaultGenerationSettings = {
  durationMode: 'voice_led',
  visualComplexity: 'rich',
  pacing: 'natural',
  captions: 'burned_in',
  audioMix: 'voice_only',
}

export const formatTypes = ['programmatic_explainer', 'multi_image_story']
export const syncPriorities = ['medium', 'high']

export const defaultRiskFlags = {
  publicFigure: false,
  syntheticVoice: false,
  aiMusic: false,
  realisticSyntheticScene: false,
}

export const generationSettingsSchema = z.object({
  durationMode: z.enum(['voice_led', 'fixed']).default('voice_led'),
  visualComplexity: z.enum(['standard', 'rich']).default('rich'),
  pacing: z.enum(['calm', 'natural', 'fast']).default('natural'),
  captions: z.enum(['burned_in', 'off']).default('burned_in'),
  audioMix: z.enum(['voice_only', 'soft_music']).default('voice_only'),
})

export const riskFlagsSchema = z
  .object({
    publicFigure: z.boolean().default(false),
    syntheticVoice: z.boolean().default(false),
    aiMusic: z.boolean().default(false),
    realisticSyntheticScene: z.boolean().default(false),
  })
  .default(defaultRiskFlags)

export const formatStrategyInputSchema = z.object({
  formatType: z.enum(formatTypes),
  contentMoat: z.string().trim().min(1, 'Content moat is required.'),
  visualSystem: z.string().trim().min(1, 'Visual system is required.'),
  syncPriority: z.enum(syncPriorities).default('medium'),
  riskFlags: riskFlagsSchema,
})

export const projectInputSchema = z.object({
  title: z.string().trim().min(1, 'Working title is required.'),
  summary: z.string().trim().min(1, 'Idea summary is required.'),
  takeaway: z.string().trim().min(1, 'Viewer takeaway is required.'),
  references: z.array(z.string().trim()).default([]),
  targetDurationSeconds: z.number().int().min(5).max(120).default(30),
  generationSettings: generationSettingsSchema.default(defaultGenerationSettings),
})

export const ideaInputSchema = projectInputSchema

function buildPolicyNotes(strategy) {
  const notes = []
  if (strategy.riskFlags.publicFigure) {
    notes.push('Public-figure material is involved; avoid impersonation and keep source notes clear.')
  }
  if (strategy.riskFlags.syntheticVoice) {
    notes.push('Synthetic voice is used; keep disclosure notes available for review.')
  }
  if (strategy.riskFlags.aiMusic) {
    notes.push('AI music is used; confirm usage rights and disclosure needs before publishing.')
  }
  if (strategy.riskFlags.realisticSyntheticScene) {
    notes.push('Realistic synthetic visuals may require disclosure if they could mislead viewers.')
  }
  return notes
}

export function normalizeFormatStrategy(input) {
  const strategy = formatStrategyInputSchema.parse(input)
  return {
    ...strategy,
    policyNotes: buildPolicyNotes(strategy),
  }
}

export function createVideoProject(input, nowIso) {
  const idea = projectInputSchema.parse(input)
  const id = `video-${nowIso.replaceAll(/[^0-9]/g, '').slice(0, 14)}`

  return {
    id,
    title: idea.title,
    status: 'idea',
    createdAt: nowIso,
    updatedAt: nowIso,
    idea,
    formatStrategy: null,
    storyboard: null,
    scenePlan: null,
    narration: null,
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
