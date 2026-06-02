const labels = ['hook', 'beats', 'ending', 'tone']

function normalizeLabel(line) {
  const match = line.trim().match(/^#{0,6}\s*(hook|beats?|ending|tone)\s*:?\s*(.*)$/i)
  if (!match) return null
  const rawLabel = match[1].toLowerCase()
  return {
    label: rawLabel === 'beat' ? 'beats' : rawLabel,
    rest: match[2].trim(),
  }
}

function trimLines(lines) {
  return lines.map((line) => line.trim()).filter(Boolean)
}

function parseBeats(lines) {
  return trimLines(lines)
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export function parseStoryboard(markdown) {
  const sections = Object.fromEntries(labels.map((label) => [label, []]))
  let currentLabel = null

  for (const line of String(markdown ?? '').split(/\r?\n/)) {
    const parsed = normalizeLabel(line)
    if (parsed) {
      currentLabel = parsed.label
      if (parsed.rest) sections[currentLabel].push(parsed.rest)
      continue
    }
    if (currentLabel) sections[currentLabel].push(line)
  }

  return {
    hook: trimLines(sections.hook).join(' '),
    beats: parseBeats(sections.beats),
    ending: trimLines(sections.ending).join(' '),
    tone: trimLines(sections.tone).join(' '),
  }
}
