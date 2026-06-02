import { expect, test } from '@playwright/test'
import { parseStoryboard } from '../../server/storyboard.js'

test('parses labeled storyboard markdown into app fields', () => {
  const storyboard = parseStoryboard(`# Storyboard

Hook:
  Start with a pivot card in the center.

Beats:
- Pick a pivot.
* Split smaller values left.
• Recursively sort both sides.

Ending:
  The sorted row snaps into place.

Tone:
  Crisp, visual, and practical.
`)

  expect(storyboard).toEqual({
    hook: 'Start with a pivot card in the center.',
    beats: ['Pick a pivot.', 'Split smaller values left.', 'Recursively sort both sides.'],
    ending: 'The sorted row snaps into place.',
    tone: 'Crisp, visual, and practical.',
  })
})

test('tolerates missing storyboard sections without throwing', () => {
  const storyboard = parseStoryboard('Hook: A clear opening only.')

  expect(storyboard).toEqual({
    hook: 'A clear opening only.',
    beats: [],
    ending: '',
    tone: '',
  })
})
