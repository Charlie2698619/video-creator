import type { VideoProject, VideoStatus } from './video'

const allowedTransitions: Record<VideoStatus, VideoStatus[]> = {
  idea: ['storyboard', 'failed'],
  storyboard: ['scene_plan', 'failed'],
  scene_plan: ['narration_script', 'failed'],
  narration_script: ['narration_ready', 'failed'],
  narration_ready: ['source_ready', 'failed'],
  source_ready: ['rendered', 'failed'],
  rendered: ['library_ready', 'failed'],
  library_ready: ['needs_review', 'failed'],
  needs_review: ['reviewed', 'failed'],
  reviewed: ['failed'],
  failed: ['idea', 'storyboard', 'scene_plan', 'narration_script', 'narration_ready', 'source_ready', 'rendered'],
}

export function canTransition(from: VideoStatus, to: VideoStatus): boolean {
  return allowedTransitions[from].includes(to)
}

export function getNextStage(project: VideoProject): VideoStatus {
  if (!project.storyboard) return 'storyboard'
  if (!project.scenePlan) return 'scene_plan'
  if (!project.narration) return 'narration_script'
  if (!project.narration.audioPath) return 'narration_ready'
  if (!project.artifacts.sourceBundle) return 'source_ready'
  if (!project.artifacts.renderResult) return 'rendered'
  if (!project.artifacts.thumbnail || !project.artifacts.metadataPath) return 'library_ready'
  if (!project.reviewChecklist || project.reviewChecklist.humanDecision === 'pending') return 'needs_review'
  return 'reviewed'
}

export function getWorkflowBlockers(project: VideoProject): string[] {
  const blockers: string[] = []
  if (!project.storyboard) blockers.push('Storyboard is required before scene planning.')
  if (project.storyboard && !project.scenePlan) blockers.push('Scene plan is required before narration.')
  if (project.scenePlan && !project.narration?.audioPath) blockers.push('Narration audio is required before HyperFrames source generation.')
  if (project.narration?.audioPath && !project.artifacts.sourceBundle) blockers.push('HyperFrames source is required before rendering.')
  if (project.artifacts.sourceBundle && !project.artifacts.renderResult) blockers.push('MP4 render is required before library import.')
  if (project.artifacts.renderResult && !project.artifacts.thumbnail) blockers.push('Thumbnail is required before review.')
  if (project.artifacts.renderResult && !project.artifacts.metadataPath) blockers.push('Metadata JSON is required before review.')
  return blockers
}
