import { expect, test } from '@playwright/test'
import { getVideoArtifactPaths, isLibraryEligible } from '../../src/domain/artifacts'
import { createVideoProject } from '../../src/domain/video'

test('maps a video id to the required artifact paths', () => {
  expect(getVideoArtifactPaths('video-20260517000000')).toEqual({
    root: 'media/videos/video-20260517000000',
    idea: 'media/videos/video-20260517000000/idea.json',
    storyboard: 'media/videos/video-20260517000000/storyboard.md',
    scenePlan: 'media/videos/video-20260517000000/scene-plan.json',
    narrationScript: 'media/videos/video-20260517000000/audio/narration.txt',
    narrationAudio: 'media/videos/video-20260517000000/audio/narration.wav',
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

test('requires source, render, and metadata before a project enters the Media Library', () => {
  const project = createVideoProject(
    {
      title: 'Library gate',
      summary: 'Partial artifacts are not enough for the library.',
      takeaway: 'The library should contain complete media records.',
      references: [],
    },
    '2026-05-17T00:00:00.000Z',
  )
  const sourceOnly = {
    ...project,
    artifacts: {
      ...project.artifacts,
      sourceBundle: {
        sourceFolder: 'media/videos/video-20260517000000/hyperframes',
        entryFile: 'media/videos/video-20260517000000/hyperframes/index.html',
        manifestPath: 'media/videos/video-20260517000000/hyperframes/source-manifest.json',
        status: 'source_ready' as const,
      },
    },
  }
  const sourceAndRender = {
    ...sourceOnly,
    artifacts: {
      ...sourceOnly.artifacts,
      renderResult: {
        mp4Path: 'media/videos/video-20260517000000/renders/render-001.mp4',
        width: 1080,
        height: 1920,
        durationSeconds: 30,
        fps: 30,
        checksum: 'abc',
        logPath: 'media/videos/video-20260517000000/renders/render-001.log.txt',
        status: 'rendered' as const,
      },
    },
  }
  const libraryReady = {
    ...sourceAndRender,
    artifacts: {
      ...sourceAndRender.artifacts,
      metadataPath: 'media/videos/video-20260517000000/metadata.json',
    },
  }

  expect(isLibraryEligible(sourceOnly)).toBe(false)
  expect(isLibraryEligible(sourceAndRender)).toBe(false)
  expect(isLibraryEligible(libraryReady)).toBe(true)
})
