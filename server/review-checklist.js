import { execFile } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { getVideoRoot, resolveInside } from './paths.js'

const execFileAsync = promisify(execFile)

export function isChecklistApproved(checklist) {
  return (
    checklist.mp4Exists &&
    checklist.mp4HasAudioStream &&
    checklist.aspectRatioIsPortrait &&
    checklist.durationMatchesPlan &&
    checklist.textReadable &&
    checklist.thumbnailExists &&
    checklist.metadataValid &&
    checklist.narrationAudioExists &&
    checklist.sourcePreserved &&
    checklist.noFailedArtifactMarkedComplete &&
    checklist.humanDecision === 'approved' &&
    Boolean(checklist.reviewedAt)
  )
}

async function mp4HasAudioStream(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'csv=p=0',
      filePath,
    ])
    return stdout.trim().split(/\s+/).includes('audio')
  } catch {
    return false
  }
}

export async function buildReviewChecklist({ repoRoot, project, humanDecision, textReadable }) {
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
    mp4HasAudioStream: project.artifacts.renderResult ? await mp4HasAudioStream(resolveInside(repoRoot, project.artifacts.renderResult.mp4Path)) : false,
    aspectRatioIsPortrait: project.artifacts.renderResult?.width === 1080 && project.artifacts.renderResult?.height === 1920,
    durationMatchesPlan: project.scenePlan ? project.artifacts.renderResult?.durationSeconds === project.scenePlan.totalDurationSeconds : true,
    textReadable: textReadable === true,
    thumbnailExists: project.artifacts.thumbnail ? await hasFile(project.artifacts.thumbnail.path) : false,
    metadataValid: project.artifacts.metadataPath ? await hasFile(project.artifacts.metadataPath) : false,
    narrationAudioExists: project.narration?.audioPath ? await hasFile(project.narration.audioPath) : false,
    sourcePreserved: project.artifacts.sourceBundle ? await hasFile(project.artifacts.sourceBundle.manifestPath) : false,
    noFailedArtifactMarkedComplete: project.failure === null,
    humanDecision,
    reviewedAt: humanDecision === 'pending' ? null : new Date().toISOString(),
  }
  const root = getVideoRoot(repoRoot, project.id)
  const checklistPath = resolveInside(root, 'review-checklist.json')
  await writeFile(checklistPath, `${JSON.stringify(checklist, null, 2)}\n`, 'utf8')
  return { checklist, checklistPath: path.relative(repoRoot, checklistPath) }
}
