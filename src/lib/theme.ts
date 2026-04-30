/**
 * Theme preference shared types/helpers.
 *
 * The user's choice is one of `light | dark | system`. We persist:
 *   - `light | dark` on the `user.themeMode` column for signed-in users
 *     (system is represented as `null` in the DB).
 *   - `light | dark | system` in the `at-store-theme` cookie (always written
 *     so SSR can resolve color-scheme without flashing for guests).
 */

export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODES = ["light", "dark", "system"] as const;
export const DEFAULT_THEME_MODE: ThemeMode = "system";

/** Cookie that mirrors the user's choice (set on every change, including for guests). */
export const THEME_COOKIE = "at-store-theme";

/** One year — long-lived so guests keep their choice across visits. */
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function parseThemeMode(value: unknown): ThemeMode {
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

/** Convert a `ThemeMode` to the value persisted in the DB (`null` for system). */
export function themeModeToDbValue(mode: ThemeMode): "light" | "dark" | null {
  return mode === "system" ? null : mode;
}

/** Convert a DB value back to a `ThemeMode` (treat unknown/null as `system`). */
export function dbValueToThemeMode(
  value: string | null | undefined,
): ThemeMode {
  return value === "light" || value === "dark" ? value : "system";
}
