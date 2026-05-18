import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { createVideoProject } from './project-model.js'
import { createProjectStore } from './project-store.js'
import { getRepoRoot, resolveInside } from './paths.js'

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
      if (request.method === 'GET' && url.pathname.startsWith('/media/videos/')) return sendMedia(repoRoot, request, response)

      return sendJson(response, 404, { error: 'Route not found.' })
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Request failed.' })
    }
  })

  await new Promise((resolve) => server.listen(port, host, resolve))
  return server
}
