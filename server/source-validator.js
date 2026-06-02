import { readFile, stat } from 'node:fs/promises'
import { resolveInside } from './paths.js'

async function fileExists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export async function validateHyperFramesSource({ repoRoot, videoId, expectAudio = false }) {
  const reasons = []
  const sourceDir = resolveInside(repoRoot, 'media', 'videos', videoId, 'hyperframes')
  const entryPath = resolveInside(sourceDir, 'index.html')
  const manifestPath = resolveInside(sourceDir, 'source-manifest.json')

  if (!(await fileExists(manifestPath))) {
    reasons.push('source-manifest.json is missing')
  }
  if (!(await fileExists(entryPath))) {
    reasons.push('index.html is missing')
  }
  if (reasons.length > 0) return { valid: false, reasons }

  try {
    const manifest = await readJsonFile(manifestPath)
    if (manifest.width !== 1080 || manifest.height !== 1920) {
      reasons.push('source-manifest.json must declare 1080x1920')
    }
  } catch {
    reasons.push('source-manifest.json must be valid JSON')
  }

  const html = await readFile(entryPath, 'utf8')
  if (!html.includes('window.__timelines')) {
    reasons.push('index.html must define window.__timelines')
  }
  if (!html.includes('data-width="1080"') || !html.includes('data-height="1920"')) {
    reasons.push('index.html must include data-width="1080" and data-height="1920"')
  }
  if (expectAudio && !html.includes('narration.wav')) {
    reasons.push('index.html must reference narration.wav when audio is expected')
  }

  return { valid: reasons.length === 0, reasons }
}
