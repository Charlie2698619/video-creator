import type { GenerationSettings, VideoProject } from '../domain/video'

type ReviewInput = {
  humanDecision: 'approved' | 'rejected'
  textReadable: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new Error('Local backend is not reachable. Start `npm run server` and keep that terminal open.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: 'Request failed.' }))) as {
      error?: string | { message?: string }
    }
    const message = typeof body.error === 'string' ? body.error : body.error?.message
    throw new Error(message ?? 'Request failed.')
  }
  return response.json() as Promise<T>
}

export const videoApi = {
  listProjects: () => request<{ projects: VideoProject[] }>('/api/projects'),
  getProject: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}`),
  createProject: (input: { title: string; summary: string; takeaway: string; references: string[]; targetDurationSeconds?: number; generationSettings?: GenerationSettings }) =>
    request<{ project: VideoProject }>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  runCodexStage: (videoId: string, stage: 'storyboard' | 'scene_plan' | 'narration' | 'source') =>
    request<{ result: { status: string; artifactPath: string }; project: VideoProject }>(`/api/projects/${videoId}/codex/${stage}`, { method: 'POST' }),
  generateNarrationAudio: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/narration/audio`, { method: 'POST' }),
  render: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/render`, { method: 'POST' }),
  thumbnail: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/thumbnail`, { method: 'POST' }),
  metadata: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/metadata`, { method: 'POST' }),
  review: (videoId: string, input: ReviewInput) =>
    request<{ project: VideoProject }>(`/api/projects/${videoId}/review`, { method: 'POST', body: JSON.stringify(input) }),
}
