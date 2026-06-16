import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { createServer } from '../../server/http.js'

async function withServer(run) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'format-strategy-api-'))
  const server = await createServer({ repoRoot, port: 0 })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  try {
    await run({ baseUrl })
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(repoRoot, { recursive: true, force: true })
  }
}

async function createProject(baseUrl) {
  const response = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Format API',
      summary: 'Persist the production format.',
      takeaway: 'Strategy gates storyboard generation.',
      references: [],
    }),
  })
  const body = await response.json()
  return body.project
}

test('saves format strategy and advances project status', async () => {
  await withServer(async ({ baseUrl }) => {
    const project = await createProject(baseUrl)
    const response = await fetch(`${baseUrl}/api/projects/${project.id}/format-strategy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        formatType: 'programmatic_explainer',
        contentMoat: 'Original point of view.',
        visualSystem: 'Axis diagram and cards.',
        syncPriority: 'high',
        riskFlags: {
          publicFigure: false,
          syntheticVoice: false,
          aiMusic: false,
          realisticSyntheticScene: false,
        },
      }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.project.status).toBe('format_strategy')
    expect(body.project.formatStrategy.formatType).toBe('programmatic_explainer')
  })
})

test('rejects storyboard generation until format strategy is saved', async () => {
  await withServer(async ({ baseUrl }) => {
    const project = await createProject(baseUrl)
    const response = await fetch(`${baseUrl}/api/projects/${project.id}/codex/storyboard`, { method: 'POST' })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error.code).toBe('FORMAT_STRATEGY_REQUIRED')
  })
})
