import type { ReviewChecklist } from './video'

export function createDefaultChecklist(): ReviewChecklist {
  return {
    mp4Exists: false,
    aspectRatioIsPortrait: false,
    durationMatchesPlan: false,
    textReadable: false,
    thumbnailExists: false,
    metadataValid: false,
    sourcePreserved: false,
    noFailedArtifactMarkedComplete: false,
    humanDecision: 'pending',
    reviewedAt: null,
  }
}

export function canMarkReviewed(checklist: ReviewChecklist): boolean {
  return (
    checklist.mp4Exists &&
    checklist.aspectRatioIsPortrait &&
    checklist.durationMatchesPlan &&
    checklist.textReadable &&
    checklist.thumbnailExists &&
    checklist.metadataValid &&
    checklist.sourcePreserved &&
    checklist.noFailedArtifactMarkedComplete &&
    checklist.humanDecision === 'approved' &&
    Boolean(checklist.reviewedAt)
  )
}
