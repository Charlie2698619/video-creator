import type { FormatType } from './video'

type CoachEntry = {
  hint: string
  example: string
  avoid: string
}

export const promptCoach = {
  idea: {
    hint: 'Describe the topic, your angle, and who this is for.',
    example: 'Explain why automation is not a content moat for indie creators.',
    avoid: 'Generic topic only, such as "AI video".',
  },
  viewerTakeaway: {
    hint: 'Say what the viewer should believe, learn, or do after watching.',
    example: 'Use AI to speed up production, not outsource taste or point of view.',
    avoid: 'A vague takeaway like "AI is useful".',
  },
  contentMoat: {
    hint: 'Name what makes this video hard to copy.',
    example: 'Original framing from the AI-channel video: automation is copyable, taste is not.',
    avoid: 'Generic claims that any AI channel could say.',
  },
  visualSystem: {
    hint: 'Describe the recurring visual language for this video.',
    example: 'Axis diagram, comparison cards, checklist, final takeaway card.',
    avoid: 'Style-only words like "modern" without concrete visual parts.',
  },
  storyboard: {
    hint: 'Give the narrative arc: hook, beats, ending, tone.',
    example: 'Hook: AI channels look easy. Beat: six formats. Ending: build long-term content value.',
    avoid: 'A list of topics with no tension or ending.',
  },
  scenePlan: {
    hint: 'Make each scene visual and timed.',
    example: '0-5s title, 5-15s two-axis diagram, 15-25s automation vs moat chart.',
    avoid: 'A paragraph with no timing or visible elements.',
  },
  narration: {
    hint: 'Write for spoken rhythm, not essay style.',
    example: 'Short sentences, clear pauses, one idea per beat.',
    avoid: 'Dense essay paragraphs or markdown headings.',
  },
  source: {
    hint: 'Tell the generator what template family and motion style to use.',
    example: 'Use kinetic typography, icon cards, clean chart transitions, burned-in captions.',
    avoid: 'Unbounded visual requests like "make it cinematic".',
  },
  thumbnail: {
    hint: 'State the click promise in one visual idea.',
    example: 'Big text: "AI Channels Are Copyable"; background: two-axis format map.',
    avoid: 'A thumbnail description with no readable promise.',
  },
  metadata: {
    hint: 'Summarize the promise, audience, and disclosure notes.',
    example: 'A short explainer about why AI video automation is useful but not a moat.',
    avoid: 'Keyword stuffing without a clear viewer promise.',
  },
} satisfies Record<string, CoachEntry>

export function getFormatHint(formatType: FormatType): string {
  if (formatType === 'multi_image_story') {
    return 'Use this when the idea needs character, emotion, tension, and scene-by-scene story panels.'
  }
  return 'Use this when the idea needs diagrams, charts, timelines, comparisons, or structured explanation.'
}
