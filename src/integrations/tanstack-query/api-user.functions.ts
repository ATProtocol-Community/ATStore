import type { Did } from '@atcute/lexicons'

import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import {
  restoreAtprotoSession,
  revokeAtprotoSession,
} from '#/integrations/auth/atproto'
import {
  fetchBlueskyHandleForDid,
} from '#/lib/bluesky-public-profile'
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
    const did = cookies['atproto-did'] as string | undefined

    if (!did) {
      return null
    }

    const atprotoSession = await restoreAtprotoSession(did as Did)
    if (!atprotoSession) {
      return null
    }

    const db = context.db
    const schema = context.schema
    const userRow = await db.query.user.findFirst({
      where: eq(schema.user.did, did),
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
    })

    if (!userRow) {
      return null
    }

    return {
      user: userRow,
      session: {
        id: crypto.randomUUID(),
        userId: userRow.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const request = getRequest()
  const cookies = parseCookies(request.headers.get('cookie'))
  const did = cookies['atproto-did'] as string | undefined

  if (did) {
    try {
      await revokeAtprotoSession(did as Did)
    } catch (error) {
      console.warn('Failed to revoke Atproto session:', error)
    }
  }

  return { success: true }
})

export const user = {
  getSession,
  getSessionQueryOptions,
  getUserProfile,
  getUserProfileQueryOptions,
  signOut,
}
