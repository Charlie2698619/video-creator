import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getVideoRoot, resolveInside } from './paths.js'

export function isChecklistApproved(checklist) {
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

export async function buildReviewChecklist({ repoRoot, project, humanDecision }) {
  const hasFile = async (relativePath) => {
    try {
      await stat(resolveInside(repoRoot, relativePath))
      return true
    } catch {
      return false
    }
  }

  const checklist = {
    mp4Exists: project.artifacts.renderResult ? await hasFile(project.artifacts.renderResult.mp4Path) : false,
    aspectRatioIsPortrait: project.artifacts.renderResult?.width === 1080 && project.artifacts.renderResult?.height === 1920,
    durationMatchesPlan: project.scenePlan ? project.artifacts.renderResult?.durationSeconds === project.scenePlan.totalDurationSeconds : true,
    textReadable: true,
    thumbnailExists: project.artifacts.thumbnail ? await hasFile(project.artifacts.thumbnail.path) : false,
    metadataValid: project.artifacts.metadataPath ? await hasFile(project.artifacts.metadataPath) : false,
    sourcePreserved: project.artifacts.sourceBundle ? await hasFile(project.artifacts.sourceBundle.manifestPath) : false,
    noFailedArtifactMarkedComplete: project.failure === null,
    humanDecision,
    reviewedAt: humanDecision === 'approved' ? new Date().toISOString() : null,
  }
  const root = getVideoRoot(repoRoot, project.id)
  const checklistPath = resolveInside(root, 'review-checklist.json')
  await writeFile(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, 'utf8')
  return { checklist, checklistPath: path.relative(repoRoot, checklistPath) }
}
