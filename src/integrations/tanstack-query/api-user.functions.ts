import type { Did } from '@atcute/lexicons'

import { isDid } from '@atcute/lexicons/syntax'
import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import {
  restoreAtprotoSession,
  revokeAtprotoSession,
} from '#/integrations/auth/atproto'
import { AUTH_SESSION_TOKEN_COOKIE } from '#/integrations/auth/constants'
import {
  fetchBlueskyHandleForDid,
} from '#/lib/bluesky-public-profile'
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
  THEME_MODES,
  dbValueToThemeMode,
  parseThemeMode,
  themeModeToDbValue,
  type ThemeMode,
} from '#/lib/theme'
import { maybeAuthMiddleware } from '#/middleware/auth'

import { dbMiddleware } from './db-middleware'

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}
  const cookiePairs = cookieHeader.split('; ').map((c) => {
    const [key, ...valueParts] = c.split('=')
    return [key ?? '', valueParts.join('=')] as [string, string]
  })
  return Object.fromEntries(cookiePairs) as Record<string, string>
}

const getSession = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const request = getRequest()
    const cookies = parseCookies(request.headers.get('cookie'))
    const sessionToken = cookies[AUTH_SESSION_TOKEN_COOKIE]

    if (!sessionToken) {
      return null
    }

    const db = context.db
    const schema = context.schema
    const sessionRow = await db.query.session.findFirst({
      where: eq(schema.session.token, sessionToken),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            did: true,
            emailVerified: true,
            image: true,
            isAdmin: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!sessionRow || sessionRow.expiresAt.getTime() <= Date.now()) {
      return null
    }

    const userRow = sessionRow.user
    if (!userRow?.did || !isDid(userRow.did)) {
      return null
    }

    const atprotoSession = await restoreAtprotoSession(userRow.did)
    if (!atprotoSession) {
      return null
    }

    return {
      user: userRow,
      session: {
        id: sessionRow.id,
        userId: userRow.id,
        expiresAt: sessionRow.expiresAt,
      },
    }
  })

const getSessionQueryOptions = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    return await getSession()
  },
})

const getUserProfile = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, maybeAuthMiddleware])
  .handler(async ({ context }) => {
    if (!context?.session?.user) {
      return null
    }

    const db = context.db
    const schema = context.schema
    const userProfile = await db.query.user.findFirst({
      where: eq(schema.user.id, context.session.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        did: true,
        image: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!userProfile) {
      throw new Error('User not found')
    }

    const blueskyHandle = userProfile.did
      ? await fetchBlueskyHandleForDid(userProfile.did)
      : null

    return { ...userProfile, blueskyHandle }
  })

const getUserProfileQueryOptions = queryOptions({
  queryKey: ['userProfile'],
  queryFn: async () => {
    return await getUserProfile()
  },
})

/**
 * Resolves the current theme preference for SSR/hydration.
 *
 * - Signed-in: returns `user.themeMode` from the DB (mapping `null` → `system`).
 *   If the cookie is out of date, we don't trust it; the DB is the source of truth.
 * - Guests: returns whatever's in the `at-store-theme` cookie (defaulting to `system`).
 *
 * Always safe to call (does not require auth).
 */
const getThemePreference = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, maybeAuthMiddleware])
  .handler(async ({ context }): Promise<{ mode: ThemeMode }> => {
    if (context?.session?.user) {
      const row = await context.db.query.user.findFirst({
        where: eq(context.schema.user.id, context.session.user.id),
        columns: { themeMode: true },
      })
      return { mode: dbValueToThemeMode(row?.themeMode ?? null) }
    }

    return { mode: parseThemeMode(getCookie(THEME_COOKIE)) }
  })

const getThemePreferenceQueryOptions = queryOptions({
  queryKey: ['themePreference'] as const,
  queryFn: () => getThemePreference(),
  staleTime: Number.POSITIVE_INFINITY,
})

/**
 * Persists a theme preference. Writes the cookie unconditionally so SSR works
 * for guests and the next response carries an up-to-date preference. Signed-in
 * users also get their `user.themeMode` column updated.
 */
const setThemePreference = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, maybeAuthMiddleware])
  .inputValidator(z.object({ mode: z.enum(THEME_MODES) }))
  .handler(async ({ data, context }): Promise<{ mode: ThemeMode }> => {
    setCookie(THEME_COOKIE, data.mode, {
      path: '/',
      sameSite: 'lax',
      maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
    })

    if (context?.session?.user) {
      await context.db
        .update(context.schema.user)
        .set({ themeMode: themeModeToDbValue(data.mode) })
        .where(eq(context.schema.user.id, context.session.user.id))
    }

    return { mode: data.mode }
  })

const signOut = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware])
  .handler(async ({ context }) => {
    const request = getRequest()
    const cookies = parseCookies(request.headers.get('cookie'))
    const sessionToken = cookies[AUTH_SESSION_TOKEN_COOKIE]

    if (sessionToken) {
      const db = context.db
      const schema = context.schema
      const sessionRow = await db.query.session.findFirst({
        where: eq(schema.session.token, sessionToken),
        with: { user: { columns: { did: true } } },
      })

      if (sessionRow) {
        await db.delete(schema.session).where(eq(schema.session.id, sessionRow.id))

        const did = sessionRow.user?.did
        if (did && isDid(did)) {
          try {
            await revokeAtprotoSession(did as Did)
          } catch (error) {
            console.warn('Failed to revoke Atproto session:', error)
          }
        }
      }
    }

    setCookie(AUTH_SESSION_TOKEN_COOKIE, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
    })

    return { success: true }
  })

export const user = {
  getSession,
  getSessionQueryOptions,
  getUserProfile,
  getUserProfileQueryOptions,
  getThemePreference,
  getThemePreferenceQueryOptions,
  setThemePreference,
  signOut,
}
