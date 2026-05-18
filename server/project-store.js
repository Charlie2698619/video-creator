import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { assertSafeVideoId, getVideoRoot, resolveInside } from './paths.js'

export { assertSafeVideoId }

export function createProjectStore(repoRoot) {
  async function ensureProjectDirs(videoId) {
    const root = getVideoRoot(repoRoot, videoId)
    await mkdir(resolveInside(root, 'hyperframes'), { recursive: true })
    await mkdir(resolveInside(root, 'renders'), { recursive: true })
    await mkdir(resolveInside(root, 'thumbnails'), { recursive: true })
    return root
  }

  return {
    async saveProject(project) {
      assertSafeVideoId(project.id)
      const root = await ensureProjectDirs(project.id)
      await writeFile(path.join(root, 'idea.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8')
      return project
    },

    async loadProject(videoId) {
      assertSafeVideoId(videoId)
      const root = getVideoRoot(repoRoot, videoId)
      return JSON.parse(await readFile(path.join(root, 'idea.json'), 'utf8'))
    },

    async listProjects() {
      const videosRoot = resolveInside(repoRoot, 'media', 'videos')
      await mkdir(videosRoot, { recursive: true })
      const entries = await readdir(videosRoot, { withFileTypes: true })
      const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      const projects = []
      for (const id of ids) {
        try {
          projects.push(await this.loadProject(id))
        } catch {
          continue
        }
      }
      return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
  }
}
