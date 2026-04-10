/**
 * Admin access for moderation UI (handle-based; override with ADMIN_HANDLE).
 */

export function getAdminHandle(): string {
  return (
    process.env.ADMIN_HANDLE?.trim().toLowerCase() ?? 'hipstersmoothie.com'
  )
}

export function isAdminHandle(handle: string | null | undefined): boolean {
  if (!handle?.trim()) return false
  return handle.trim().toLowerCase() === getAdminHandle()
}
