import { expect, test } from '@playwright/test'
import { canTransition, getNextStage, getWorkflowBlockers } from '../../src/domain/workflow'
import { createVideoProject } from '../../src/domain/video'

test('allows only linear V1 workflow transitions', () => {
  expect(canTransition('idea', 'storyboard')).toBe(true)
  expect(canTransition('storyboard', 'scene_plan')).toBe(true)
  expect(canTransition('source_ready', 'reviewed')).toBe(false)
  expect(canTransition('rendered', 'reviewed')).toBe(false)
})

test('reports missing artifacts before review', () => {
  const project = createVideoProject(
    {
      title: 'Artifact honesty',
      summary: 'Explain source versus render.',
      takeaway: 'A source file is not a finished video.',
      references: [],
    },
    '2026-05-17T00:00:00.000Z',
  )

  expect(getNextStage(project)).toBe('storyboard')
  expect(getWorkflowBlockers(project)).toContain('Storyboard is required before scene planning.')
})
