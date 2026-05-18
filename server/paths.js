import path from 'node:path'

export function getRepoRoot() {
  return process.cwd()
}

export function assertSafeVideoId(videoId) {
  if (!/^video-[a-zA-Z0-9-]+$/.test(videoId)) {
    throw new Error('Invalid video id.')
  }
}

export function resolveInside(root, ...segments) {
  const resolved = path.resolve(root, ...segments)
  const normalizedRoot = path.resolve(root)
  const rootWithSeparator = `${normalizedRoot}${path.sep}`
  if (resolved !== normalizedRoot && !resolved.startsWith(rootWithSeparator)) {
    throw new Error('Path escapes workspace.')
  }
  return resolved
}

export function getVideoRoot(repoRoot, videoId) {
  assertSafeVideoId(videoId)
  return resolveInside(repoRoot, 'media', 'videos', videoId)
}
