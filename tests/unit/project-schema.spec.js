import { expect, test } from '@playwright/test'
import {
  createVideoProject,
  formatStrategyInputSchema,
  normalizeFormatStrategy,
  projectInputSchema,
} from '../../server/project-schema.mjs'

const validInput = {
  title: 'Shared schema',
  summary: 'Use one project factory for server and frontend.',
  takeaway: 'The contract should reject invalid input consistently.',
  references: [],
}

test('shared project schema defaults target duration to 30 seconds', () => {
  const project = createVideoProject(validInput, '2026-06-06T00:00:00.000Z')

  expect(project.id).toBe('video-20260606000000')
  expect(project.status).toBe('idea')
  expect(project.idea.targetDurationSeconds).toBe(30)
  expect(project.idea.generationSettings).toEqual({
    durationMode: 'voice_led',
    visualComplexity: 'rich',
    pacing: 'natural',
    captions: 'burned_in',
    audioMix: 'voice_only',
  })
})

test('shared project schema rejects invalid titles and durations', () => {
  const invalidInputs = [
    { ...validInput, title: '   ' },
    { ...validInput, targetDurationSeconds: 30.5 },
    { ...validInput, targetDurationSeconds: 4 },
    { ...validInput, targetDurationSeconds: 121 },
  ]

  for (const input of invalidInputs) {
    expect(() => projectInputSchema.parse(input)).toThrow()
    expect(() => createVideoProject(input, '2026-06-06T00:00:00.000Z')).toThrow()
  }
})

test('new projects start without a saved format strategy', () => {
  const project = createVideoProject(validInput, '2026-06-16T00:00:00.000Z')

  expect(project.status).toBe('idea')
  expect(project.formatStrategy).toBeNull()
})

test('normalizes programmatic explainer strategy with policy notes', () => {
  const strategy = normalizeFormatStrategy({
    formatType: 'programmatic_explainer',
    contentMoat: 'Original point of view and audience framing.',
    visualSystem: 'Axis diagram, kinetic text, comparison cards.',
    syncPriority: 'high',
    riskFlags: {
      publicFigure: false,
      syntheticVoice: true,
      aiMusic: false,
      realisticSyntheticScene: false,
    },
  })

  expect(strategy).toMatchObject({
    formatType: 'programmatic_explainer',
    contentMoat: 'Original point of view and audience framing.',
    visualSystem: 'Axis diagram, kinetic text, comparison cards.',
    syncPriority: 'high',
    riskFlags: {
      publicFigure: false,
      syntheticVoice: true,
      aiMusic: false,
      realisticSyntheticScene: false,
    },
  })
  expect(strategy.policyNotes).toContain('Synthetic voice is used; keep disclosure notes available for review.')
})

test('format strategy rejects unsupported formats and empty moat fields', () => {
  const invalidInputs = [
    {
      formatType: 'stock_footage_explainer',
      contentMoat: 'Source research.',
      visualSystem: 'Stock clips.',
      syncPriority: 'medium',
    },
    {
      formatType: 'programmatic_explainer',
      contentMoat: '   ',
      visualSystem: 'Cards.',
      syncPriority: 'medium',
    },
    {
      formatType: 'multi_image_story',
      contentMoat: 'Character arc.',
      visualSystem: '',
      syncPriority: 'medium',
    },
  ]

  for (const input of invalidInputs) {
    expect(() => formatStrategyInputSchema.parse(input)).toThrow()
    expect(() => normalizeFormatStrategy(input)).toThrow()
  }
})
