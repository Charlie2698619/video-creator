import { expect, test } from '@playwright/test'
import { videoApi } from '../../src/api/videoApi'

test('reports a clear error when the local backend is unreachable', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch

  try {
    await expect(videoApi.listProjects()).rejects.toThrow('Local backend is not reachable')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports structured backend error messages', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            code: 'PROJECT_NOT_FOUND',
            category: 'not_found',
            message: 'Project not found.',
          },
        }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      ),
    )) as typeof fetch

  try {
    await expect(videoApi.getProject('video-1')).rejects.toThrow('Project not found.')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('sends explicit review decisions', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ path: string; init?: RequestInit }> = []
  globalThis.fetch = ((path, init) => {
    requests.push({ path: String(path), init })
    return Promise.resolve(
      new Response(JSON.stringify({ project: { id: 'video-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }) as typeof fetch

  try {
    await videoApi.review('video-1', { humanDecision: 'rejected', textReadable: true })
    expect(requests).toHaveLength(1)
    expect(requests[0].path).toBe('/api/projects/video-1/review')
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      humanDecision: 'rejected',
      textReadable: true,
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('saves format strategy through the API client', async () => {
  const originalFetch = globalThis.fetch
  const requests: Array<{ path: string; init?: RequestInit }> = []
  globalThis.fetch = ((path, init) => {
    requests.push({ path: String(path), init })
    return Promise.resolve(
      new Response(JSON.stringify({ project: { id: 'video-1', formatStrategy: {} } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  }) as typeof fetch

  try {
    await videoApi.saveFormatStrategy('video-1', {
      formatType: 'programmatic_explainer',
      contentMoat: 'Original source framing.',
      visualSystem: 'Axis diagram and cards.',
      syncPriority: 'high',
      riskFlags: {
        publicFigure: false,
        syntheticVoice: false,
        aiMusic: false,
        realisticSyntheticScene: false,
      },
    })

    expect(requests).toHaveLength(1)
    expect(requests[0].path).toBe('/api/projects/video-1/format-strategy')
    expect(JSON.parse(String(requests[0].init?.body))).toMatchObject({
      formatType: 'programmatic_explainer',
      contentMoat: 'Original source framing.',
      visualSystem: 'Axis diagram and cards.',
      syncPriority: 'high',
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
