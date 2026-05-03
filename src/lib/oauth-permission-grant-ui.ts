/**
 * Permission-bundle section copy surfaced in the storefront scopes popover.
 *
 * Keeps `"use client"` modules from importing `#/lib/oauth-listing-auth-probe`, which
 * depends on Node (`fs`, `dns`, …) — see `oauth-scope-include-parse.ts`.
 */

export const PERMISSION_GRANT_POSTS_STORED_RECORDS_HEADING =
  "Posts / stored records";
export const PERMISSION_GRANT_FILE_UPLOADS_HEADING = "File uploads";
export const PERMISSION_GRANT_REMOTE_ACTIONS_HEADING = "Remote actions";
export const PERMISSION_GRANT_ACCOUNT_RELATED_HEADING = "Account-related data";
export const PERMISSION_GRANT_IDENTITY_HEADING = "Identity / profile";
/** Permission row with an unknown `resource` value. */
export const PERMISSION_GRANT_OTHER_TECHNICAL_HEADING = "Technical permission";
/** `type !== "permission"` rows in lexicon bundles. */
export const PERMISSION_GRANT_UNRECOGNIZED_ENTRY_HEADING =
  "Unrecognized checklist entry";

/** Subheading for list blocks aligned with repo permissions. */
export const PERMISSION_GRANT_RECORDS_LIST_LABEL = "Records";
/** Subheading for repo `action` tokens (verbs). */
export const PERMISSION_GRANT_ALLOWED_VERBS_LIST_LABEL = "Allowed verbs";
/** Subheading for RPC `lxm` names. */
export const PERMISSION_GRANT_BACKEND_CALLS_LIST_LABEL = "Backend calls";

export interface PermissionGrantUnorderedList {
  readonly kind: "unorderedList";
  /** Semibold label above `<ul>`. */
  readonly label: string;
  readonly items: ReadonlyArray<string>;
}

/** Separator between flattened permission-grant summaries (e.g. RPC block then repo block). */
export interface PermissionGrantSectionGap {
  readonly kind: "sectionGap";
}

export type PermissionGrantStructuredLine =
  | string
  | PermissionGrantUnorderedList
  | PermissionGrantSectionGap;

export function isPermissionGrantSectionGap(
  line: PermissionGrantStructuredLine,
): line is PermissionGrantSectionGap {
  return (
    typeof line === "object" &&
    line !== null &&
    "kind" in line &&
    line.kind === "sectionGap"
  );
}

export function isPermissionGrantUnorderedList(
  line: PermissionGrantStructuredLine,
): line is PermissionGrantUnorderedList {
  return (
    typeof line === "object" &&
    line !== null &&
    "kind" in line &&
    line.kind === "unorderedList"
  );
}

/** First line rendered with stronger weight — plain paragraphs only (`string` bullet lines). */
export const PERMISSION_GRANT_SECTION_HEADINGS: ReadonlySet<string> = new Set([
  PERMISSION_GRANT_POSTS_STORED_RECORDS_HEADING,
  PERMISSION_GRANT_FILE_UPLOADS_HEADING,
  PERMISSION_GRANT_REMOTE_ACTIONS_HEADING,
  PERMISSION_GRANT_ACCOUNT_RELATED_HEADING,
  PERMISSION_GRANT_IDENTITY_HEADING,
  PERMISSION_GRANT_OTHER_TECHNICAL_HEADING,
  PERMISSION_GRANT_UNRECOGNIZED_ENTRY_HEADING,
]);
