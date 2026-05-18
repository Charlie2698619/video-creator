import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { runCodexStage } from './codex-runner.js'
import { renderHyperFrames } from './hyperframes-renderer.js'
import { writeMetadata } from './metadata.js'
import { createVideoProject } from './project-model.js'
import { createProjectStore } from './project-store.js'
import { buildReviewChecklist, isChecklistApproved } from './review-checklist.js'
import { getRepoRoot, resolveInside } from './paths.js'
import { createThumbnail } from './thumbnailer.js'

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://127.0.0.1:5173',
  })
  response.end(`${JSON.stringify(body)}\n`)
}

async function sendMedia(repoRoot, request, response) {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const filePath = resolveInside(repoRoot, url.pathname.slice(1))
  const data = await readFile(filePath)
  const type = filePath.endsWith('.mp4') ? 'video/mp4' : filePath.endsWith('.png') ? 'image/png' : 'application/octet-stream'
  response.writeHead(200, { 'content-type': type })
  response.end(data)
}

export async function createServer(options = {}) {
  const repoRoot = options.repoRoot ?? getRepoRoot()
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? Number(process.env.PORT ?? 8787)
  const store = createProjectStore(repoRoot)

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${host}:${port}`)

      if (request.method === 'OPTIONS') return sendJson(response, 204, {})
      if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true })
      if (request.method === 'GET' && url.pathname === '/api/projects') return sendJson(response, 200, { projects: await store.listProjects() })
      if (request.method === 'POST' && url.pathname === '/api/projects') {
        const input = await readJson(request)
        const project = createVideoProject(input, new Date().toISOString())
        await store.saveProject(project)
        return sendJson(response, 201, { project })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/codex\/(storyboard|scene_plan|source)$/.test(url.pathname)) {
        const [, videoId, stage] = url.pathname.match(/^\/api\/projects\/([^/]+)\/codex\/(storyboard|scene_plan|source)$/)
        const project = await store.loadProject(videoId)
        const result = await runCodexStage({
          repoRoot,
          videoId,
          stage,
          projectTitle: project.title,
          testMode: process.env.VIDEO_CREATOR_TEST_MODE === '1',
        })
        if (stage === 'storyboard') {
          project.storyboard = { hook: 'Saved in storyboard.md', beats: ['Saved in storyboard.md'], ending: 'Saved in storyboard.md', tone: 'Saved in storyboard.md' }
          project.status = 'storyboard'
        }
        if (stage === 'scene_plan') {
          project.scenePlan = JSON.parse(await readFile(resolveInside(repoRoot, `media/videos/${videoId}/scene-plan.json`), 'utf8'))
          project.status = 'scene_plan'
        }
        if (stage === 'source') {
          project.artifacts.sourceBundle = {
            sourceFolder: `media/videos/${videoId}/hyperframes`,
            entryFile: `media/videos/${videoId}/hyperframes/index.html`,
            manifestPath: `media/videos/${videoId}/hyperframes/source-manifest.json`,
            status: 'source_ready',
          }
          project.status = 'source_ready'
        }
        project.updatedAt = new Date().toISOString()
        await store.saveProject(project)
        return sendJson(response, 200, { result, project })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/render$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/render$/)
        const renderResult = await renderHyperFrames({
          repoRoot,
          videoId,
          testMode: process.env.VIDEO_CREATOR_TEST_MODE === '1',
        })
        const project = await store.loadProject(videoId)
        project.artifacts.renderResult = renderResult
        project.status = 'rendered'
        project.updatedAt = new Date().toISOString()
        await store.saveProject(project)
        return sendJson(response, 200, { project })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/thumbnail$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/thumbnail$/)
        const project = await store.loadProject(videoId)
        const thumbnail = await createThumbnail({ repoRoot, videoId, mp4Path: project.artifacts.renderResult.mp4Path })
        project.artifacts.thumbnail = thumbnail
        project.updatedAt = new Date().toISOString()
        await store.saveProject(project)
        return sendJson(response, 200, { project })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/metadata$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/metadata$/)
        const project = await store.loadProject(videoId)
        project.artifacts.metadataPath = await writeMetadata({ repoRoot, project })
        project.status = 'library_ready'
        project.updatedAt = new Date().toISOString()
        await store.saveProject(project)
        return sendJson(response, 200, { project })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/review$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/review$/)
        const body = await readJson(request)
        const project = await store.loadProject(videoId)
        const { checklist, checklistPath } = await buildReviewChecklist({ repoRoot, project, humanDecision: body.humanDecision })
        project.reviewChecklist = checklist
        project.artifacts.reviewChecklistPath = checklistPath
        project.status = isChecklistApproved(checklist) ? 'reviewed' : 'needs_review'
        project.updatedAt = new Date().toISOString()
        await store.saveProject(project)
        return sendJson(response, 200, { project })
      }
      if (request.method === 'GET' && url.pathname.startsWith('/media/videos/')) return sendMedia(repoRoot, request, response)

      return sendJson(response, 404, { error: 'Route not found.' })
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Request failed.' })
    }
  })

  await new Promise((resolve) => server.listen(port, host, resolve))
  return server
}
