import { useEffect, useState } from 'react'
import { videoApi } from './api/videoApi'
import { AppLayout } from './components/AppLayout'
import type { VideoProject } from './domain/video'
import './App.css'

export default function App() {
  const [projects, setProjects] = useState<VideoProject[]>([])
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      try {
        const { projects: savedProjects } = await videoApi.listProjects()
        if (cancelled) return
        setProjects(savedProjects)
        setActiveProject(savedProjects[0] ?? null)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load saved projects.')
      } finally {
        if (!cancelled) setLoadingProjects(false)
      }
    }

    void loadProjects()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppLayout
      activeProject={activeProject}
      projects={projects}
      error={error}
      loadingProjects={loadingProjects}
      onError={setError}
      onProjectChanged={(project) => {
        setActiveProject(project)
        setProjects((currentProjects) => {
          const existingIndex = currentProjects.findIndex((candidate) => candidate.id === project.id)
          if (existingIndex === -1) return [project, ...currentProjects]
          return currentProjects.map((candidate) => (candidate.id === project.id ? project : candidate))
        })
      }}
    />
  )
}
