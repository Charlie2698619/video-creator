import type { VideoProject } from './video'

export type VideoArtifactPaths = {
  root: string
  idea: string
  storyboard: string
  scenePlan: string
  narrationScript: string
  narrationAudio: string
  hyperframes: string
  renders: string
  thumbnails: string
  metadata: string
  reviewChecklist: string
}

export function getVideoArtifactPaths(videoId: string): VideoArtifactPaths {
  const root = `media/videos/${videoId}`
  return {
    root,
    idea: `${root}/idea.json`,
    storyboard: `${root}/storyboard.md`,
    scenePlan: `${root}/scene-plan.json`,
    narrationScript: `${root}/audio/narration.txt`,
    narrationAudio: `${root}/audio/narration.wav`,
    hyperframes: `${root}/hyperframes`,
    renders: `${root}/renders`,
    thumbnails: `${root}/thumbnails`,
    metadata: `${root}/metadata.json`,
    reviewChecklist: `${root}/review-checklist.json`,
  }
}

export function isLibraryEligible(project: VideoProject): boolean {
  return Boolean(project.artifacts.sourceBundle && project.artifacts.renderResult && project.artifacts.metadataPath)
}
