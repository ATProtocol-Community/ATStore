import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ne, or, isNull } from 'drizzle-orm'
import { z } from 'zod'

import {
  fetchBlueskyHandleForDid,
  resolveBlueskyHandleToDid,
} from '#/lib/bluesky-public-profile'
import { SUPER_ADMIN_DID } from '#/lib/super-admin'
import { superAdminFnMiddleware } from '#/middleware/auth'

import { dbMiddleware } from './db-middleware'

const grantAdminByHandleInput = z.object({
  handle: z.string().min(1).max(253),
})

const revokeAdminInput = z.object({
  userId: z.string().min(1),
})

const listAdmins = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, superAdminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        did: schema.user.did,
        image: schema.user.image,
        createdAt: schema.user.createdAt,
        updatedAt: schema.user.updatedAt,
      })
      .from(schema.user)
      .where(eq(schema.user.isAdmin, true))
      .orderBy(desc(schema.user.updatedAt))

    const withHandles = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        isSuperAdmin: row.did === SUPER_ADMIN_DID,
        handle: row.did ? await fetchBlueskyHandleForDid(row.did) : null,
      })),
    )

    return withHandles
  })

const listAdminsQueryOptions = queryOptions({
  queryKey: ['super-admin', 'admins'],
  queryFn: async () => listAdmins(),
})

const grantAdminByHandle = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, superAdminFnMiddleware])
  .inputValidator(grantAdminByHandleInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context
    const trimmed = data.handle.trim().replace(/^@/, '')
    if (!trimmed) {
      throw new Error('Enter a handle.')
    }

    const did = await resolveBlueskyHandleToDid(trimmed)
    if (!did) {
      throw new Error(`Could not resolve ${trimmed} to a DID.`)
    }

    const existing = await db.query.user.findFirst({
      where: eq(schema.user.did, did),
      columns: { id: true, name: true, isAdmin: true },
    })

    if (!existing) {
      throw new Error(
        `${trimmed} has not signed in yet. Ask them to log in once before granting admin.`,
      )
    }

    if (existing.isAdmin) {
      return { ok: true as const, alreadyAdmin: true, handle: trimmed, did }
    }

    await db
      .update(schema.user)
      .set({ isAdmin: true, updatedAt: new Date() })
      .where(eq(schema.user.id, existing.id))

    return { ok: true as const, alreadyAdmin: false, handle: trimmed, did }
  })

const revokeAdmin = createServerFn({ method: 'POST' })
  .middleware([dbMiddleware, superAdminFnMiddleware])
  .inputValidator(revokeAdminInput)
  .handler(async ({ data, context }) => {
    const { db, schema } = context

    const target = await db.query.user.findFirst({
      where: eq(schema.user.id, data.userId),
      columns: { id: true, did: true },
    })

    if (!target) {
      throw new Error('User not found.')
    }

    if (target.did === SUPER_ADMIN_DID) {
      throw new Error('The super admin cannot be revoked.')
    }

    await db
      .update(schema.user)
      .set({ isAdmin: false, updatedAt: new Date() })
      .where(
        and(
          eq(schema.user.id, target.id),
          // Belt-and-suspenders: never accidentally revoke the super admin.
          or(isNull(schema.user.did), ne(schema.user.did, SUPER_ADMIN_DID)),
        ),
      )

    return { ok: true as const }
  })

const listSignedInUsers = createServerFn({ method: 'GET' })
  .middleware([dbMiddleware, superAdminFnMiddleware])
  .handler(async ({ context }) => {
    const { db, schema } = context
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        did: schema.user.did,
        image: schema.user.image,
        isAdmin: schema.user.isAdmin,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .orderBy(desc(schema.user.createdAt))

    const withHandles = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        handle: row.did ? await fetchBlueskyHandleForDid(row.did) : null,
      })),
    )

    return withHandles
  })

const listSignedInUsersQueryOptions = queryOptions({
  queryKey: ['super-admin', 'signed-in-users'],
  queryFn: async () => listSignedInUsers(),
})

export const superAdminApi = {
  listAdmins,
  listAdminsQueryOptions,
  listSignedInUsers,
  listSignedInUsersQueryOptions,
  grantAdminByHandle,
  revokeAdmin,
}
