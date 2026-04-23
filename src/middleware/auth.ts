/**
 * Authentication middleware for TanStack Start routes.
 * DB and OAuth session restore are loaded dynamically so this module stays client-safe.
 */

import { Client } from '@atcute/client'
import { isDid } from '@atcute/lexicons/syntax'
import { and, eq } from 'drizzle-orm'
import { redirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { SUPER_ADMIN_DID } from '#/lib/super-admin'
import { getSafePostLoginRedirect } from '#/utils/auth-redirect'

export type AtprotoSessionContext = {
  did: string
  atprotoSession: unknown
  client: Client
  session: {
    user: {
      id: string
      name: string
      email: string | null
      did: string | null
      image: string | null
      isAdmin: boolean
    }
  }
}

/** Session + ATProto `Client` when cookies and OAuth session are valid. */
export async function getAtprotoSessionForRequest(
  request: Request,
): Promise<AtprotoSessionContext | undefined> {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookiePairs = cookieHeader.split('; ').map((c) => {
    const [key, ...valueParts] = c.split('=')
    return [key ?? '', valueParts.join('=')] as [string, string]
  })
  const cookies = Object.fromEntries(cookiePairs) as Record<string, string>
  const did = cookies['atproto-did'] as string | undefined

  if (!did || !isDid(did)) {
    return
  }

  const [{ db }, schema, { restoreAtprotoSession }] = await Promise.all([
    import('#/db/index.server'),
    import('#/db/schema'),
    import('#/integrations/auth/atproto'),
  ])

  const atprotoSession = await restoreAtprotoSession(did)

  if (!atprotoSession) {
    return
  }

  const account = await db.query.account.findFirst({
    where: and(
      eq(schema.account.accountId, did),
      eq(schema.account.providerId, 'atproto'),
    ),
    with: { user: true },
  })

  if (!account?.user) {
    return
  }

  const client = new Client({ handler: atprotoSession })

  return { did, atprotoSession, client, session: { user: account.user } }
}

async function getSessionContext(request: Request) {
  return getAtprotoSessionForRequest(request)
}

/** Route middleware: redirect authenticated users away (e.g. from `/login`). */
export const unauthMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  const context = await getSessionContext(request)

  if (context) {
    throw redirect({ to: '/' })
  }

  return await next()
})

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  const context = await getSessionContext(request)

  if (!context) {
    throw redirect({
      to: '/login',
      search: { redirect: getSafePostLoginRedirect(request) },
    })
  }

  return await next({ context })
})

/** Route middleware: only allow users flagged as admin in the `user` table. */
export const adminRouteMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest()
  const context = await getAtprotoSessionForRequest(request)

  if (!context) {
    throw redirect({
      to: '/login',
      search: { redirect: getSafePostLoginRedirect(request) },
    })
  }

  if (!context.session.user.isAdmin) {
    throw redirect({ to: '/' })
  }

  return await next({ context })
})

/** Server function middleware: attach session when present. */
export const maybeAuthMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
    const context = await getSessionContext(request)
    return await next({ context })
  },
)

/** Server functions: require an admin-flagged user row. */
export const adminFnMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
    const ctx = await getAtprotoSessionForRequest(request)
    if (!ctx) {
      throw new Error('Unauthorized')
    }
    if (!ctx.session.user.isAdmin) {
      throw new Error('Forbidden')
    }
    return await next({ context: { adminSession: ctx } })
  },
)

/** Server functions: only the hard-coded super admin DID (hipstersmoothie.com). */
export const superAdminFnMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
    const ctx = await getAtprotoSessionForRequest(request)
    if (!ctx) {
      throw new Error('Unauthorized')
    }
    if (ctx.did !== SUPER_ADMIN_DID) {
      throw new Error('Forbidden')
    }
    return await next({ context: { superAdminSession: ctx } })
  },
)
