import type { VideoProject } from '../domain/video'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: 'Request failed.' }))) as { error?: string }
    throw new Error(body.error ?? 'Request failed.')
  }
  return response.json() as Promise<T>
}

export const videoApi = {
  listProjects: () => request<{ projects: VideoProject[] }>('/api/projects'),
  createProject: (input: { title: string; summary: string; takeaway: string; references: string[] }) =>
    request<{ project: VideoProject }>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  runCodexStage: (videoId: string, stage: 'storyboard' | 'scene_plan' | 'source') =>
    request<{ result: { status: string; artifactPath: string }; project: VideoProject }>(`/api/projects/${videoId}/codex/${stage}`, { method: 'POST' }),
  render: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/render`, { method: 'POST' }),
  thumbnail: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/thumbnail`, { method: 'POST' }),
  metadata: (videoId: string) => request<{ project: VideoProject }>(`/api/projects/${videoId}/metadata`, { method: 'POST' }),
  review: (videoId: string) =>
    request<{ project: VideoProject }>(`/api/projects/${videoId}/review`, { method: 'POST', body: JSON.stringify({ humanDecision: 'approved' }) }),
}
