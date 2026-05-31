import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getVideoRoot, resolveInside } from './paths.js'

export function buildHyperFramesRenderArgs({ sourceDir, outputPath }) {
  return ['--yes', 'hyperframes', 'render', sourceDir, '--output', outputPath, '--resolution', 'portrait', '--fps', '30', '--quality', 'standard', '--strict']
}

export async function getNextRenderPath(
  rendersDir,
  exists = async (candidate) => {
    try {
      await stat(candidate)
      return true
    } catch {
      return false
    }
  },
) {
  for (let index = 1; index < 1000; index += 1) {
    const candidate = path.join(rendersDir, `render-${String(index).padStart(3, '0')}.mp4`)
    if (!(await exists(candidate))) return candidate
  }
  throw new Error('No render filename is available.')
}

async function checksum(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex')
}

async function runProcess(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', async (code) => {
      if (options.logPath) await writeFile(options.logPath, stderr, 'utf8')
      if (code === 0) resolve()
      else reject(new Error(stderr || `${command} exited with code ${code}.`))
    })
  })
}

export async function renderHyperFrames({ repoRoot, videoId, testMode = false }) {
  const root = getVideoRoot(repoRoot, videoId)
  const sourceDir = resolveInside(root, 'hyperframes')
  const rendersDir = resolveInside(root, 'renders')
  await mkdir(rendersDir, { recursive: true })
  const outputPath = await getNextRenderPath(rendersDir)
  const logPath = outputPath.replace(/\.mp4$/, '.log.txt')

  if (testMode) {
    const narrationAudioPath = resolveInside(root, 'audio', 'narration.wav')
    let hasNarrationAudio
    try {
      await stat(narrationAudioPath)
      hasNarrationAudio = true
    } catch {
      hasNarrationAudio = false
    }
    const args = hasNarrationAudio
      ? [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=black:s=1080x1920:d=30:r=30',
          '-i',
          narrationAudioPath,
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-pix_fmt',
          'yuv420p',
          '-c:v',
          'libx264',
          '-c:a',
          'aac',
          '-shortest',
          outputPath,
        ]
      : ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1080x1920:d=30:r=30', '-pix_fmt', 'yuv420p', outputPath]
    await runProcess('ffmpeg', args, { logPath })
    return {
      mp4Path: path.relative(repoRoot, outputPath),
      width: 1080,
      height: 1920,
      durationSeconds: 30,
      fps: 30,
      checksum: await checksum(outputPath),
      logPath: path.relative(repoRoot, logPath),
      status: 'rendered',
    }
  }

  await runProcess('npx', buildHyperFramesRenderArgs({ sourceDir, outputPath }), { cwd: repoRoot, logPath })

  return {
    mp4Path: path.relative(repoRoot, outputPath),
    width: 1080,
    height: 1920,
    durationSeconds: 30,
    fps: 30,
    checksum: await checksum(outputPath),
    logPath: path.relative(repoRoot, logPath),
    status: 'rendered',
  }
}
