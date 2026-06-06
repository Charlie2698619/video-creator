import { expect, test } from '@playwright/test'
import { createVideoProject, projectInputSchema } from '../../server/project-schema.mjs'

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
