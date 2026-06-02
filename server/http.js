import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { runCodexStage } from './codex-runner.js'
import { renderHyperFrames } from './hyperframes-renderer.js'
import { writeMetadata } from './metadata.js'
import { generateNarrationAudio } from './narration.js'
import { createVideoProject } from './project-model.js'
import { createProjectStore } from './project-store.js'
import { buildReviewChecklist, isChecklistApproved } from './review-checklist.js'
import { normalizeScenePlan } from './scene-plan.js'
import { resolveHyperFramesSource } from './source-resolver.js'
import { parseStoryboard } from './storyboard.js'
import { getRepoRoot, resolveInside } from './paths.js'
import { createThumbnail } from './thumbnailer.js'

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

class ApiError extends Error {
  constructor(status, code, category, message) {
    super(message)
    this.status = status
    this.code = code
    this.category = category
  }
}

function invalidState(code, message) {
  return new ApiError(409, code, 'invalid_state', message)
}

function validationError(code, message) {
  return new ApiError(400, code, 'validation', message)
}

function projectNotFound() {
  return new ApiError(404, 'PROJECT_NOT_FOUND', 'not_found', 'Project not found.')
}

function normalizeError(error) {
  if (error instanceof ApiError) return error
  if (error?.code === 'ENOENT') return new ApiError(404, 'RESOURCE_NOT_FOUND', 'not_found', 'Required file was not found.')
  if (error instanceof SyntaxError) return validationError('INVALID_JSON', 'Request body must be valid JSON.')
  if (error?.name === 'ZodError') return validationError('INVALID_INPUT', 'Request input is invalid.')
  return new ApiError(400, 'REQUEST_FAILED', 'request_failed', error instanceof Error ? error.message : 'Request failed.')
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://127.0.0.1:5173',
  })
  response.end(`${JSON.stringify(body)}\n`)
}

function sendError(response, error) {
  const apiError = normalizeError(error)
  return sendJson(response, apiError.status, {
    error: {
      code: apiError.code,
      category: apiError.category,
      message: apiError.message,
    },
  })
}

function parseReviewInput(body) {
  if (body.humanDecision !== 'approved' && body.humanDecision !== 'rejected') {
    throw validationError('INVALID_REVIEW_DECISION', 'Review decision must be approved or rejected.')
  }
  if (typeof body.textReadable !== 'boolean') {
    throw validationError('INVALID_TEXT_READABLE', 'Readable-text confirmation is required.')
  }
  return { humanDecision: body.humanDecision, textReadable: body.textReadable }
}

async function loadProjectOr404(store, videoId) {
  try {
    return await store.loadProject(videoId)
  } catch (error) {
    if (error?.code === 'ENOENT') throw projectNotFound()
    throw error
  }
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
      if (request.method === 'GET' && /^\/api\/projects\/[^/]+$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)$/)
        return sendJson(response, 200, { project: await loadProjectOr404(store, videoId) })
      }
      if (request.method === 'POST' && url.pathname === '/api/projects') {
        const input = await readJson(request)
        const project = createVideoProject(input, new Date().toISOString())
        await store.saveProject(project)
        return sendJson(response, 201, { project })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/codex\/(storyboard|scene_plan|narration|source)$/.test(url.pathname)) {
        const [, videoId, stage] = url.pathname.match(/^\/api\/projects\/([^/]+)\/codex\/(storyboard|scene_plan|narration|source)$/)
        const project = await loadProjectOr404(store, videoId)
        if (stage === 'source') {
          if (!project.scenePlan) throw invalidState('SCENE_PLAN_REQUIRED', 'Scene plan is required before source generation.')
          if (!project.narration?.audioPath) throw invalidState('NARRATION_AUDIO_REQUIRED', 'Narration audio is required before source generation.')
          const sourceBundle = await resolveHyperFramesSource({ repoRoot, project })
          const nextProject = {
            ...project,
            artifacts: { ...project.artifacts, sourceBundle },
            status: 'source_ready',
            updatedAt: new Date().toISOString(),
          }
          await store.saveProject(nextProject)
          return sendJson(response, 200, {
            result: { status: 'completed', artifactPath: sourceBundle.manifestPath, promptPath: null },
            project: nextProject,
          })
        }
        const result = await runCodexStage({
          repoRoot,
          videoId,
          stage,
          projectTitle: project.title,
          storyboard: stage === 'scene_plan' ? project.storyboard : null,
          narrationAudioPath: project.narration?.audioPath ?? null,
          targetDurationSeconds: project.idea.targetDurationSeconds,
          generationSettings: project.idea.generationSettings ?? {},
          ideaSummary: project.idea.summary,
          viewerTakeaway: project.idea.takeaway,
          testMode: process.env.VIDEO_CREATOR_TEST_MODE === '1',
        })
        let nextProject = project
        if (stage === 'storyboard') {
          nextProject = {
            ...project,
            storyboard: parseStoryboard(await readFile(resolveInside(repoRoot, result.artifactPath), 'utf8')),
            status: 'storyboard',
          }
        }
        if (stage === 'scene_plan') {
          nextProject = {
            ...project,
            scenePlan: normalizeScenePlan(JSON.parse(await readFile(resolveInside(repoRoot, `media/videos/${videoId}/scene-plan.json`), 'utf8'))),
            status: 'scene_plan',
          }
        }
        if (stage === 'narration') {
          nextProject = {
            ...project,
            narration: {
              scriptPath: result.artifactPath,
              audioPath: null,
              voice: 'af_nova',
              durationSeconds: project.scenePlan?.totalDurationSeconds ?? project.idea.targetDurationSeconds,
              status: 'script_ready',
            },
            status: 'narration_script',
          }
        }
        nextProject = { ...nextProject, updatedAt: new Date().toISOString() }
        await store.saveProject(nextProject)
        return sendJson(response, 200, { result, project: nextProject })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/narration\/audio$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/narration\/audio$/)
        const project = await loadProjectOr404(store, videoId)
        if (!project.narration?.scriptPath) throw invalidState('NARRATION_SCRIPT_REQUIRED', 'Narration script is required before voiceover generation.')
        const audio = await generateNarrationAudio({
          repoRoot,
          videoId,
          scriptPath: project.narration.scriptPath,
          voice: project.narration.voice,
          durationSeconds: project.narration.durationSeconds,
          testMode: process.env.VIDEO_CREATOR_TEST_MODE === '1',
        })
        const nextProject = {
          ...project,
          narration: {
            ...project.narration,
            audioPath: audio.audioPath,
            voice: audio.voice,
            durationSeconds: audio.durationSeconds,
            status: 'audio_ready',
          },
          status: 'narration_ready',
          updatedAt: new Date().toISOString(),
        }
        await store.saveProject(nextProject)
        return sendJson(response, 200, { project: nextProject })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/render$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/render$/)
        const renderResult = await renderHyperFrames({
          repoRoot,
          videoId,
          testMode: process.env.VIDEO_CREATOR_TEST_MODE === '1',
        })
        const project = await loadProjectOr404(store, videoId)
        const nextProject = {
          ...project,
          artifacts: { ...project.artifacts, renderResult },
          status: 'rendered',
          updatedAt: new Date().toISOString(),
        }
        await store.saveProject(nextProject)
        return sendJson(response, 200, { project: nextProject })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/thumbnail$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/thumbnail$/)
        const project = await loadProjectOr404(store, videoId)
        if (!project.artifacts.renderResult) throw invalidState('RENDER_REQUIRED', 'MP4 render is required before thumbnail generation.')
        const thumbnail = await createThumbnail({ repoRoot, videoId, mp4Path: project.artifacts.renderResult.mp4Path })
        const nextProject = {
          ...project,
          artifacts: { ...project.artifacts, thumbnail },
          updatedAt: new Date().toISOString(),
        }
        await store.saveProject(nextProject)
        return sendJson(response, 200, { project: nextProject })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/metadata$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/metadata$/)
        const project = await loadProjectOr404(store, videoId)
        if (!project.artifacts.thumbnail) throw invalidState('THUMBNAIL_REQUIRED', 'Thumbnail is required before metadata generation.')
        const metadataPath = await writeMetadata({ repoRoot, project })
        const nextProject = {
          ...project,
          artifacts: { ...project.artifacts, metadataPath },
          status: 'library_ready',
          updatedAt: new Date().toISOString(),
        }
        await store.saveProject(nextProject)
        return sendJson(response, 200, { project: nextProject })
      }
      if (request.method === 'POST' && /^\/api\/projects\/[^/]+\/review$/.test(url.pathname)) {
        const [, videoId] = url.pathname.match(/^\/api\/projects\/([^/]+)\/review$/)
        const body = await readJson(request)
        const reviewInput = parseReviewInput(body)
        const project = await loadProjectOr404(store, videoId)
        const { checklist, checklistPath } = await buildReviewChecklist({ repoRoot, project, ...reviewInput })
        const nextProject = {
          ...project,
          reviewChecklist: checklist,
          artifacts: { ...project.artifacts, reviewChecklistPath: checklistPath },
          status: isChecklistApproved(checklist) ? 'reviewed' : 'needs_review',
          updatedAt: new Date().toISOString(),
        }
        await store.saveProject(nextProject)
        return sendJson(response, 200, { project: nextProject })
      }
      if (request.method === 'GET' && url.pathname.startsWith('/media/videos/')) return sendMedia(repoRoot, request, response)

      throw new ApiError(404, 'ROUTE_NOT_FOUND', 'not_found', 'Route not found.')
    } catch (error) {
      return sendError(response, error)
    }
  })

  await new Promise((resolve) => server.listen(port, host, resolve))
  return server
}
