import { expect, test } from '@playwright/test'
import { createVideoProject, videoStatuses } from '../../src/domain/video'

test('creates an idea-stage project with a 30 second default', () => {
  const project = createVideoProject(
    {
      title: 'Build log short',
      summary: 'Turn a debugging note into a short video.',
      takeaway: 'Small tooling choices change creative speed.',
      references: ['https://example.com/source'],
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(project.status).toBe('idea')
  expect(project.idea.targetDurationSeconds).toBe(30)
  expect(project.narration).toBeNull()
  expect(project.artifacts.sourceBundle).toBeNull()
  expect(videoStatuses).toContain('reviewed')
})
