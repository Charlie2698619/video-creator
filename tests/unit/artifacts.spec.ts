import { expect, test } from '@playwright/test'
import { getVideoArtifactPaths, isLibraryEligible } from '../../src/domain/artifacts'
import { createVideoProject } from '../../src/domain/video'

test('maps a video id to the required artifact paths', () => {
  expect(getVideoArtifactPaths('video-20260517000000')).toEqual({
    root: 'media/videos/video-20260517000000',
    idea: 'media/videos/video-20260517000000/idea.json',
    storyboard: 'media/videos/video-20260517000000/storyboard.md',
    scenePlan: 'media/videos/video-20260517000000/scene-plan.json',
    hyperframes: 'media/videos/video-20260517000000/hyperframes',
    renders: 'media/videos/video-20260517000000/renders',
    thumbnails: 'media/videos/video-20260517000000/thumbnails',
    metadata: 'media/videos/video-20260517000000/metadata.json',
    reviewChecklist: 'media/videos/video-20260517000000/review-checklist.json',
  })
})

test('keeps idea-only projects out of the Media Library', () => {
  const project = createVideoProject(
    {
      title: 'Library gate',
      summary: 'Only real artifacts belong in the library.',
      takeaway: 'The library is not an idea inbox.',
      references: [],
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(isLibraryEligible(project)).toBe(false)
})
