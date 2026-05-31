import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getVideoRoot, resolveInside } from './paths.js'

async function checksum(repoRoot, relativePath) {
  return createHash('sha256').update(await readFile(resolveInside(repoRoot, relativePath))).digest('hex')
}

export async function writeMetadata({ repoRoot, project }) {
  const root = getVideoRoot(repoRoot, project.id)
  const metadataPath = resolveInside(root, 'metadata.json')
  const required = [
    project.narration?.scriptPath,
    project.narration?.audioPath,
    project.artifacts.sourceBundle?.manifestPath,
    project.artifacts.renderResult?.mp4Path,
    project.artifacts.thumbnail?.path,
  ].filter(Boolean)
  for (const relativePath of required) await stat(resolveInside(repoRoot, relativePath))

  const metadata = {
    videoId: project.id,
    title: project.title,
    ideaSummary: project.idea.summary,
    narration: project.narration
      ? {
          scriptPath: project.narration.scriptPath,
          audioPath: project.narration.audioPath,
          voice: project.narration.voice,
          durationSeconds: project.narration.durationSeconds,
        }
      : null,
    sourcePaths: project.artifacts.sourceBundle ? [project.artifacts.sourceBundle.sourceFolder, project.artifacts.sourceBundle.manifestPath] : [],
    mp4Path: project.artifacts.renderResult?.mp4Path ?? null,
    thumbnailPath: project.artifacts.thumbnail?.path ?? null,
    aspectRatio: '9:16',
    durationSeconds: project.artifacts.renderResult?.durationSeconds ?? project.idea.targetDurationSeconds,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sourceTool: 'Codex + HyperFrames',
    reviewStatus: project.status,
    checksums: {
      mp4: project.artifacts.renderResult ? await checksum(repoRoot, project.artifacts.renderResult.mp4Path) : null,
      narrationAudio: project.narration?.audioPath ? await checksum(repoRoot, project.narration.audioPath) : null,
      thumbnail: project.artifacts.thumbnail ? await checksum(repoRoot, project.artifacts.thumbnail.path) : null,
    },
  }
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
  return path.relative(repoRoot, metadataPath)
}
