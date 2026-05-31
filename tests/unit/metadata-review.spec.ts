import { expect, test } from '@playwright/test'
import { canMarkReviewed, createDefaultChecklist } from '../../src/domain/review'
import { createVideoProject } from '../../src/domain/video'

test('does not mark a video reviewed until every required check passes', () => {
  const checklist = createDefaultChecklist()
  expect(canMarkReviewed(checklist)).toBe(false)

  expect(
    canMarkReviewed({
      ...checklist,
      mp4Exists: true,
      mp4HasAudioStream: true,
      aspectRatioIsPortrait: true,
      durationMatchesPlan: true,
      textReadable: true,
      thumbnailExists: true,
      metadataValid: true,
      narrationAudioExists: true,
      sourcePreserved: true,
      noFailedArtifactMarkedComplete: true,
      humanDecision: 'approved',
      reviewedAt: '2026-05-17T00:00:00.000Z',
    }),
  ).toBe(true)
})

test('keeps rendered projects out of reviewed state without a checklist', () => {
  const project = createVideoProject(
    {
      title: 'Review gate',
      summary: 'Review is separate from rendering.',
      takeaway: 'Rendered does not mean approved.',
      references: [],
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(project.reviewChecklist).toBeNull()
})
