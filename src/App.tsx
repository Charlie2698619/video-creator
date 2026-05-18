import { useState } from 'react'
import { AppLayout } from './components/AppLayout'
import type { VideoProject } from './domain/video'
import './App.css'

export default function App() {
  const [projects, setProjects] = useState<VideoProject[]>([])
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <AppLayout
      activeProject={activeProject}
      projects={projects}
      error={error}
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
