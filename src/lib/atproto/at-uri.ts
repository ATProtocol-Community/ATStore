/**
 * Parse `at://did/collection/rkey` URIs returned by `com.atproto.repo.*`.
 */
export function parseAtUri(uri: string): {
  repo: string
  collection: string
  rkey: string
} | null {
  if (!uri.startsWith('at://')) return null
  const rest = uri.slice('at://'.length)
  const firstSlash = rest.indexOf('/')
  if (firstSlash === -1) return null
  const repo = rest.slice(0, firstSlash)
  const path = rest.slice(firstSlash + 1)
  const secondSlash = path.indexOf('/')
  if (secondSlash === -1) return null
  const collection = path.slice(0, secondSlash)
  const rkey = path.slice(secondSlash + 1)
  if (!repo || !collection || !rkey) return null
  return { repo, collection, rkey }
}
