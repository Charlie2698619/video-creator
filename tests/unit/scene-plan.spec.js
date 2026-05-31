import { expect, test } from '@playwright/test'
import { normalizeScenePlan } from '../../server/scene-plan.js'

test('normalizes real Codex scene-plan JSON into the app schema', () => {
  const scenePlan = normalizeScenePlan({
    format: { durationSeconds: 30 },
    scenes: [
      {
        id: 'scene-01',
        timing: { start: 0, end: 5, duration: 5 },
        visualDirection: 'Milo and Daisy see a glowing cookie.',
        onScreenText: 'A moon cookie?',
        motionNotes: 'Slow push in.',
        audioNotes: 'Soft sparkle.',
      },
    ],
    acceptanceCriteria: ['Readable text.'],
  })

  expect(scenePlan).toEqual({
    scenes: [
      {
        sceneNumber: 1,
        durationSeconds: 5,
        visualDirection: 'Milo and Daisy see a glowing cookie.',
        onScreenText: 'A moon cookie?',
        motionNotes: 'Slow push in.',
        audioNotes: 'Soft sparkle.',
        acceptanceCriteria: ['Readable text.'],
      },
    ],
    totalDurationSeconds: 30,
  })
})

test('rejects scene plans without usable scene timing', () => {
  expect(() =>
    normalizeScenePlan({
      scenes: [{ visualDirection: 'Missing duration.', onScreenText: 'Oops', motionNotes: 'None.' }],
    }),
  ).toThrow('Scene 1 is missing a duration.')
})
