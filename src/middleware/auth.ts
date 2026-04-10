/**
 * Authentication middleware for TanStack Start routes.
 */

import { Client } from '@atcute/client'
import { isDid } from '@atcute/lexicons/syntax'
import { and, eq } from 'drizzle-orm'
import { redirect } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { restoreAtprotoSession } from '#/integrations/auth/atproto'
import { db } from '#/db/index.server'
import * as schema from '#/db/schema'
import { getSafePostLoginRedirect } from '#/utils/auth-redirect'

async function getSessionContext(request: Request) {
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

/** Server function middleware: attach session when present. */
export const maybeAuthMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()
    const context = await getSessionContext(request)
    return await next({ context })
  },
)
