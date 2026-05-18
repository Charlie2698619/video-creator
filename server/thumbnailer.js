import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { getVideoRoot, resolveInside } from './paths.js'

export function buildFfmpegThumbnailArgs({ mp4Path, thumbnailPath }) {
  return [
    '-y',
    '-i',
    mp4Path,
    '-vf',
    'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
    '-frames:v',
    '1',
    thumbnailPath,
  ]
}

async function checksum(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

export async function createThumbnail({ repoRoot, videoId, mp4Path }) {
  const root = getVideoRoot(repoRoot, videoId)
  const thumbnailsDir = resolveInside(root, 'thumbnails')
  await mkdir(thumbnailsDir, { recursive: true })
  const thumbnailPath = path.join(thumbnailsDir, 'thumbnail-001.png')

  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', buildFfmpegThumbnailArgs({ mp4Path: resolveInside(repoRoot, mp4Path), thumbnailPath }), {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `FFmpeg exited with code ${code}.`))
    })
  })

  await stat(thumbnailPath)
  return { path: path.relative(repoRoot, thumbnailPath), width: 1080, height: 1920, checksum: await checksum(thumbnailPath) }
}
