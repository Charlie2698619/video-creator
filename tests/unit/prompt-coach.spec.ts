import { expect, test } from '@playwright/test'
import { getFormatHint, promptCoach } from '../../src/domain/promptCoach'

test('provides compact hints for every major prompt field', () => {
  expect(promptCoach.idea.hint).toContain('topic')
  expect(promptCoach.viewerTakeaway.example).toContain('Use AI')
  expect(promptCoach.contentMoat.avoid).toContain('Generic')
  expect(promptCoach.visualSystem.hint).toContain('visual language')
  expect(promptCoach.storyboard.example).toContain('Hook:')
  expect(promptCoach.scenePlan.example).toContain('0-5s')
  expect(promptCoach.narration.hint).toContain('spoken rhythm')
  expect(promptCoach.thumbnail.example).toContain('AI Channels')
})

test('returns format-specific hints', () => {
  expect(getFormatHint('programmatic_explainer')).toContain('diagrams')
  expect(getFormatHint('multi_image_story')).toContain('character')
})
