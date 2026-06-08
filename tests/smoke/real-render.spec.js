import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { checkTools, resolveCommand } from '../../server/doctor.js'
import { createServer } from '../../server/http.js'

const execFileAsync = promisify(execFile)

test.skip(process.env.VIDEO_CREATOR_REAL_SMOKE !== '1', 'Set VIDEO_CREATOR_REAL_SMOKE=1 to run the real render smoke test.')
test.describe.configure({ timeout: 20 * 60_000 })

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function requestJson(baseUrl, route, { method = 'GET', data } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: data === undefined ? undefined : { 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(`${method} ${route} failed with ${response.status}: ${text}`)
  return body
}

async function probeMp4(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_type',
    '-of',
    'json',
    filePath,
  ])
  return JSON.parse(stdout)
}

async function expectFile(filePath) {
  expect((await stat(filePath)).isFile()).toBe(true)
}

function missingToolNames(tools) {
  return Object.entries(tools)
    .filter(([, status]) => !status.present)
    .map(([name]) => name)
}

test('real pipeline creates idea-specific source and a rendered MP4', async () => {
  const repoRoot = process.cwd()
  const tools = await checkTools({ repoRoot })
  const missingTools = missingToolNames(tools)
  test.skip(missingTools.length > 0, `Missing required real-render tools: ${missingTools.join(', ')}`)
  test.skip(!(await resolveCommand('npx')), 'npx is required to run HyperFrames.')

  const originalTestMode = process.env.VIDEO_CREATOR_TEST_MODE
  delete process.env.VIDEO_CREATOR_TEST_MODE

  let server = null
  let projectId = null
  try {
    server = await createServer({ repoRoot, host: '127.0.0.1', port: 0 })
    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`
    const title = `Explain quicksort in 30s ${randomUUID()}`

    const created = await requestJson(baseUrl, '/api/projects', {
      method: 'POST',
      data: {
        title,
        summary: 'Explain quicksort with pivots, partitions, and recursive array sorting.',
        takeaway: 'Viewers should understand why partitioning around a pivot makes sorting efficient.',
        references: [],
        targetDurationSeconds: 30,
        generationSettings: {
          durationMode: 'voice_led',
          visualComplexity: 'rich',
          pacing: 'natural',
          captions: 'burned_in',
          audioMix: 'voice_only',
        },
      },
    })
    projectId = created.project.id

    for (const route of [
      '/codex/storyboard',
      '/codex/scene_plan',
      '/codex/narration',
      '/narration/audio',
      '/codex/source',
      '/render',
      '/thumbnail',
      '/metadata',
    ]) {
      await requestJson(baseUrl, `/api/projects/${projectId}${route}`, { method: 'POST' })
    }

    const { project } = await requestJson(baseUrl, `/api/projects/${projectId}`)
    const sourceBundle = project.artifacts.sourceBundle
    const renderResult = project.artifacts.renderResult

    expect(project.status).toBe('library_ready')
    expect(project.storyboard.beats.length).toBeGreaterThan(0)
    expect(JSON.stringify(project.scenePlan).toLowerCase()).toMatch(/quick|sort|pivot|partition|array/)
    expect(['codex', 'fallback']).toContain(sourceBundle.origin)
    expect(renderResult.mp4Path).toMatch(/render-\d{3}\.mp4$/)

    const sourceHtml = await readFile(path.join(repoRoot, sourceBundle.entryFile), 'utf8')
    expect(sourceHtml.toLowerCase()).toMatch(/quick|sort|pivot|partition|array/)

    const mp4Path = path.join(repoRoot, renderResult.mp4Path)
    await expectFile(mp4Path)
    const probe = await probeMp4(mp4Path)
    expect(probe.streams.some((stream) => stream.codec_type === 'audio')).toBe(true)
    expect(Number(probe.format.duration)).toBeGreaterThan(0)

    await expectFile(path.join(repoRoot, project.artifacts.metadataPath))
    await expectFile(path.join(repoRoot, project.artifacts.thumbnail.path))
  } finally {
    if (originalTestMode === undefined) delete process.env.VIDEO_CREATOR_TEST_MODE
    else process.env.VIDEO_CREATOR_TEST_MODE = originalTestMode
    if (server) await closeServer(server)
    if (projectId) await rm(path.join(repoRoot, 'media/videos', projectId), { recursive: true, force: true })
  }
})
