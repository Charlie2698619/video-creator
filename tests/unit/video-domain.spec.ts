import { expect, test } from '@playwright/test'
import { createVideoProject, formatTypes, videoStatuses } from '../../src/domain/video'

test('creates an idea-stage project with a 30 second default', () => {
  const project = createVideoProject(
    {
      title: 'Build log short',
      summary: 'Turn a debugging note into a short video.',
      takeaway: 'Small tooling choices change creative speed.',
      references: ['https://example.com/source'],
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(project.status).toBe('idea')
  expect(project.idea.targetDurationSeconds).toBe(30)
  expect(project.idea.generationSettings).toEqual({
    durationMode: 'voice_led',
    visualComplexity: 'rich',
    pacing: 'natural',
    captions: 'burned_in',
    audioMix: 'voice_only',
  })
  expect(project.narration).toBeNull()
  expect(project.formatStrategy).toBeNull()
  expect(project.artifacts.sourceBundle).toBeNull()
  expect(videoStatuses).toContain('format_strategy')
  expect(videoStatuses).toContain('reviewed')
  expect(formatTypes).toEqual(['programmatic_explainer', 'multi_image_story'])
})

test('accepts human-oriented generation settings', () => {
  const project = createVideoProject(
    {
      title: 'Human tutorial',
      summary: 'Make a warm explainer.',
      takeaway: 'Natural pacing makes AI video easier to watch.',
      references: [],
      targetDurationSeconds: 45,
      generationSettings: {
        durationMode: 'fixed',
        visualComplexity: 'standard',
        pacing: 'calm',
        captions: 'off',
        audioMix: 'soft_music',
      },
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(project.idea.targetDurationSeconds).toBe(45)
  expect(project.idea.generationSettings).toEqual({
    durationMode: 'fixed',
    visualComplexity: 'standard',
    pacing: 'calm',
    captions: 'off',
    audioMix: 'soft_music',
  })
})
