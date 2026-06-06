import { z } from 'zod'

export const videoStatuses = [
  'idea',
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

export const generationSettingsSchema = z.object({
  durationMode: z.enum(['voice_led', 'fixed']).default('voice_led'),
  visualComplexity: z.enum(['standard', 'rich']).default('rich'),
  pacing: z.enum(['calm', 'natural', 'fast']).default('natural'),
  captions: z.enum(['burned_in', 'off']).default('burned_in'),
  audioMix: z.enum(['voice_only', 'soft_music']).default('voice_only'),
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
