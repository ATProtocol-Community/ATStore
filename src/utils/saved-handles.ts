import Cookies from 'universal-cookie'

export const SAVED_HANDLES_COOKIE_NAME = 'saved-handles:v1'

export interface SavedHandle {
  handle: string
  avatar: string | null
  lastUsed: number
}

export function getSavedHandles(
  cookieHeader?: string | null,
): Array<SavedHandle> {
  try {
    const cookies = new Cookies(cookieHeader || undefined)
    const cookieValue = cookies.get(SAVED_HANDLES_COOKIE_NAME)
    if (!cookieValue) {
      return []
    }
    return cookieValue as Array<SavedHandle>
  } catch (error) {
    console.error({ error })
    return []
  }
}

export function saveHandle(handle: string, avatar: string | null): void {
  if (globalThis.window === undefined) {
    return
  }

  try {
    const saved = getSavedHandles()
    const filtered = saved.filter((h) => h.handle !== handle)
    const updated = [{ handle, avatar, lastUsed: Date.now() }, ...filtered]
      .sort((a: SavedHandle, b: SavedHandle) => b.lastUsed - a.lastUsed)
      .slice(0, 5)

    const cookies = new Cookies()
    const maxAge = 365 * 24 * 60 * 60
    const isSecure = globalThis.location.protocol === 'https:'

    cookies.set(SAVED_HANDLES_COOKIE_NAME, JSON.stringify(updated), {
      path: '/',
      sameSite: 'lax',
      secure: isSecure,
      maxAge,
    })
  } catch {
    // Cookies might be unavailable
  }
}
