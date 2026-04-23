/**
 * Super admin is the single hard-coded DID authorized to manage other admins.
 * Today this is `hipstersmoothie.com` — the site owner.
 */
export const SUPER_ADMIN_DID = 'did:plc:m2sjv3wncvsasdapla35hzwj' as const

export function isSuperAdminDid(did: string | null | undefined): boolean {
  return !!did && did === SUPER_ADMIN_DID
}
