"use client";

import * as stylex from "@stylexjs/stylex";
import { Shield } from "lucide-react";
import { Button } from "react-aria-components";

import type { DirectoryListingOAuthProbe } from "../integrations/tanstack-query/api-directory-listings.functions";
import type { SummaryScopeHumanRow } from "../lib/oauth-listing-auth-probe";

import { Flex } from "../design-system/flex";
import { Popover } from "../design-system/popover";
import { Separator } from "../design-system/separator";
import { uiColor, warningColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} from "../design-system/theme/typography.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { parseIncludeScopeToken } from "../lib/oauth-scope-include-parse";

const PERMISSION_DETAIL_MAX_LINES = 12;

/** Baseline OAuth scope token; surfaced as plain-language consent (matches typical host consent screen). */
const BASELINE_ACCOUNT_SCOPE = "atproto";

/** Parseable grouping for merged probe tokens (`repo:`, `include:…`, transitional, …). */
type ScopeBucket =
  | "profile"
  | "bundle"
  | "repo"
  | "blob"
  | "transitional"
  | "other";

const BUCKET_LABEL: Record<ScopeBucket, string> = {
  profile: "Wants access to your account",
  bundle: "Included permission bundles",
  repo: "May read or change data",
  blob: "May read or upload files & media",
  transitional: "Legacy broad access",
  other: "Other",
};

const BUCKET_ORDER: Array<ScopeBucket> = [
  "profile",
  "bundle",
  "repo",
  "blob",
  "transitional",
  "other",
];

type StorefrontSyntheticBaselineConsent = SummaryScopeHumanRow & {
  storefrontSyntheticBaselineConsent: true;
};

function isSyntheticBaselineConsentRow(row: SummaryScopeHumanRow): boolean {
  return (
    (
      row as SummaryScopeHumanRow & {
        storefrontSyntheticBaselineConsent?: boolean;
      }
    ).storefrontSyntheticBaselineConsent === true
  );
}

/** Mirrors host consent wording; hides the bare `atproto` token elsewhere. */
function baselineConsentSyntheticRow(): SummaryScopeHumanRow {
  const row: StorefrontSyntheticBaselineConsent = {
    token: BASELINE_ACCOUNT_SCOPE,
    description: BUCKET_LABEL.profile,
    storefrontSyntheticBaselineConsent: true,
  };
  return row;
}

const styles = stylex.create({
  bundlePanel: {
    borderColor: uiColor.border2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: verticalSpace.md,
    paddingInline: horizontalSpace.md,
    backgroundColor: uiColor.bgSubtle,
  },
  bundleBulletList: {
    gap: verticalSpace.sm,
    marginBlock: 0,
    marginInline: 0,
    display: "flex",
    flexDirection: "column",
    listStyleType: "none",
    paddingInlineStart: horizontalSpace["lg"],
  },
  bundleLineText: {
    display: "block",
  },
  bundleTokenFooter: {
    borderBlockStartColor: uiColor.border2,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    marginBlockStart: verticalSpace.sm,
    paddingBlockStart: verticalSpace.sm,
  },
  bundleTokenLabel: {
    color: uiColor.text2,
    display: "block",
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.sm,
    marginBlockEnd: verticalSpace.xs,
  },
  bundleTokenValue: {
    color: uiColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.base,
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },
  metaFooter: {
    marginBlock: 0,
    borderBlockStartColor: uiColor.border2,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    paddingBlockStart: verticalSpace.xl,
  },
  popoverSurface: {
    maxHeight: "min(480px, 78vh)",
    maxWidth: "min(432px, 94vw)",
    overflowX: "hidden",
    overflowY: "auto",
  },
  scopesLinkChip: {
    borderColor: uiColor.border1,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: uiColor.component1,
      ":hover": uiColor.component2,
    },
    color: uiColor.text2,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    outlineColor: {
      ":focus-visible": uiColor.border2,
    },
    outlineOffset: {
      ":focus-visible": 2,
    },
    outlineStyle: {
      ":focus-visible": "solid",
    },
    outlineWidth: {
      ":focus-visible": 2,
    },
    paddingBottom: verticalSpace.sm,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace.sm,
  },
  scopesChipInner: {
    gap: gap.sm,
    alignItems: "center",
    display: "inline-flex",
  },
  scopesLinkChipElevated: {
    borderColor: warningColor.border1,
    backgroundColor: {
      default: warningColor.component1,
      ":hover": warningColor.component2,
    },
    color: warningColor.text2,
  },
  sectionList: {
    gap: verticalSpace.md,
    listStyle: "none",
    marginBlock: 0,
    display: "flex",
    flexDirection: "column",
    paddingInlineStart: 0,
  },
  scopeRowInner: {
    minWidth: 0,
    width: "100%",
  },
  tokenChip: {
    color: uiColor.text1,
    flexShrink: 0,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    wordBreak: "break-all",
    maxWidth: "100%",
  },

  tokenCommaList: {
    color: uiColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.base,
    wordBreak: "break-all",
  },
});

/** Warn only when the app's published OAuth client metadata `scope` field lists `transition:generic`. */
function oauthProbeClientListsTransitionGeneric(
  probe: DirectoryListingOAuthProbe,
): boolean {
  const line = probe.clientScopeRawLine;
  if (!line?.trim()) return false;
  const tokens = line
    .replaceAll("\u00A0", " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.includes("transition:generic");
}

function scopeTokenBucket(token: string): ScopeBucket {
  const t = token.trim();
  if (!t) return "other";
  if (parseIncludeScopeToken(t) !== null) return "bundle";
  if (t === "atproto") return "profile";
  if (t.startsWith("repo:")) return "repo";
  if (t.startsWith("blob:")) return "blob";
  if (t.startsWith("transition:")) return "transitional";
  return "other";
}

/** Human-readable probe rows grouped for display. Empty buckets omitted. */
function groupScopeHumanRows(
  rows: Array<SummaryScopeHumanRow>,
): Array<{ bucket: ScopeBucket; rows: Array<SummaryScopeHumanRow> }> {
  const map = new Map<ScopeBucket, Array<SummaryScopeHumanRow>>();
  for (const row of rows) {
    const bucket = scopeTokenBucket(row.token);
    const next = map.get(bucket) ?? [];
    next.push(row);
    map.set(bucket, next);
  }
  return BUCKET_ORDER.filter((b) => (map.get(b)?.length ?? 0) > 0).map((b) => ({
    bucket: b,
    rows: map.get(b) ?? [],
  }));
}

/** Fallback when we only have loose tokens (no `scopeHumanReadable` rows). */
function groupPlainTokens(tokens: Array<string>): Array<{
  bucket: ScopeBucket;
  tokens: Array<string>;
}> {
  const map = new Map<ScopeBucket, Array<string>>();
  const sorted = [...tokens].toSorted((a, b) => a.localeCompare(b));
  for (const t of sorted) {
    const bucket = scopeTokenBucket(t);
    const next = map.get(bucket) ?? [];
    next.push(t);
    map.set(bucket, next);
  }
  return BUCKET_ORDER.filter((b) => (map.get(b)?.length ?? 0) > 0).map((b) => ({
    bucket: b,
    tokens: map.get(b) ?? [],
  }));
}

function bundleStructuredLines(row: SummaryScopeHumanRow): Array<string> {
  return "includePermissionSet" in row
    ? row.includePermissionSet.structuredLines
    : [];
}

/** Last NSID segment as a short heading, e.g. `app.bsky.authCreatePosts` → "Auth Create Posts". */
function readableNameFromBundleNsid(nsid: string): string {
  const parts = nsid
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean);
  const last = parts.at(-1);
  if (!last) return nsid;
  const words = last
    .replaceAll("_", " ")
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return nsid;
  return words
    .map((w) =>
      w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

function CompactScopeHumanRow({ row }: { row: SummaryScopeHumanRow }) {
  const unresolved =
    "includePermissionSetUnresolved" in row
      ? row.includePermissionSetUnresolved
      : null;
  const resolved =
    "includePermissionSet" in row ? row.includePermissionSet : null;

  const includeScope = parseIncludeScopeToken(row.token);
  const isBundleRow = includeScope !== null || unresolved !== null;

  const lines = bundleStructuredLines(row);
  const clipped =
    lines.length > PERMISSION_DETAIL_MAX_LINES
      ? [...lines.slice(0, PERMISSION_DETAIL_MAX_LINES), "…"]
      : lines;

  const nsid = resolved?.nsid ?? unresolved?.nsid ?? includeScope?.nsid ?? null;

  const headline =
    (resolved?.title?.trim() ? resolved.title.trim() : null) ??
    (nsid ? readableNameFromBundleNsid(nsid) : null);

  const detail = resolved?.detail?.trim() ? resolved.detail.trim() : null;

  if (!isBundleRow) {
    return (
      <li>
        <Flex direction="column" gap="xs" style={styles.scopeRowInner}>
          <SmallBody style={styles.tokenChip}>{row.token}</SmallBody>
        </Flex>
      </li>
    );
  }

  return (
    <li>
      <Flex direction="column" gap="3xl" style={styles.bundlePanel}>
        {headline ? (
          <Text size="sm" weight="semibold">
            {headline}
          </Text>
        ) : null}
        {detail ? <SmallBody variant="secondary">{detail}</SmallBody> : null}
        {clipped.length > 0 ? (
          <ul {...stylex.props(styles.bundleBulletList)}>
            {clipped.map((line, index) => (
              <li key={`bundle-${line.slice(0, 48)}-${String(index)}`}>
                <Text
                  size="sm"
                  variant="secondary"
                  leading="lg"
                  style={styles.bundleLineText}
                >
                  {line}
                </Text>
              </li>
            ))}
          </ul>
        ) : null}
        {unresolved?.reason?.trim() ? (
          <SmallBody variant="secondary">{unresolved.reason}</SmallBody>
        ) : null}
        <div {...stylex.props(styles.bundleTokenFooter)}>
          <span {...stylex.props(styles.bundleTokenLabel)}>
            OAuth scope token
          </span>
          <span {...stylex.props(styles.bundleTokenValue)}>{row.token}</span>
        </div>
      </Flex>
    </li>
  );
}

function formatProbedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Storefront prefers client_metadata tokens — merged AS catalogs only when unpublished. */
function storefrontClientScopeLensActive(
  probe: DirectoryListingOAuthProbe,
): boolean {
  return probe.oauthClientScopesDistinct.length > 0;
}

function storefrontScopeHumanReadable(
  probe: DirectoryListingOAuthProbe,
): Array<SummaryScopeHumanRow> {
  if (!storefrontClientScopeLensActive(probe)) {
    return probe.scopeHumanReadable;
  }
  const allow = new Set(probe.oauthClientScopesDistinct);
  return probe.scopeHumanReadable.filter((r) => allow.has(r.token));
}

function storefrontPlainScopeTokens(
  probe: DirectoryListingOAuthProbe,
): Array<string> {
  if (!storefrontClientScopeLensActive(probe)) {
    return [
      ...new Set([...probe.oauthScopesDistinct, ...probe.transitionalScopes]),
    ];
  }
  return probe.oauthClientScopesDistinct;
}

function storefrontScopesPopoverIntro(props: {
  probe: DirectoryListingOAuthProbe | null;
}) {
  const probe = props.probe;

  const clientLensActive =
    probe != null && probe.oauthClientScopesDistinct.length > 0;

  const hasMergedScopes =
    probe != null &&
    (probe.oauthScopesDistinct.length > 0 ||
      probe.transitionalScopes.length > 0);

  return (
    <SmallBody variant="secondary">
      {clientLensActive ? (
        <>
          Listed scopes come from OAuth <strong>client_metadata</strong> (what
          this app may ask for at sign-in).
        </>
      ) : hasMergedScopes ? (
        <>
          No OAuth client_metadata scope field was found; listing may reflect
          authorization-server scope catalogs{" "}
          <strong>this app never requests</strong>.
        </>
      ) : null}
    </SmallBody>
  );
}

function storefrontScopesPopoverBody(props: {
  probe: DirectoryListingOAuthProbe;
}) {
  const humanRaw = storefrontScopeHumanReadable(props.probe);
  const plainRaw = storefrontPlainScopeTokens(props.probe);

  const baselineRequested =
    humanRaw.some(
      (r) => r.token.trim().toLowerCase() === BASELINE_ACCOUNT_SCOPE,
    ) ||
    plainRaw.some((t) => t.trim().toLowerCase() === BASELINE_ACCOUNT_SCOPE);

  const humanWithoutBaselineToken = humanRaw.filter(
    (r) => r.token.trim().toLowerCase() !== BASELINE_ACCOUNT_SCOPE,
  );
  const plainWithoutBaselineToken = plainRaw.filter(
    (t) => t.trim().toLowerCase() !== BASELINE_ACCOUNT_SCOPE,
  );

  const humansForGrouped: Array<SummaryScopeHumanRow> = [
    ...(baselineRequested ? [baselineConsentSyntheticRow()] : []),
    ...humanWithoutBaselineToken,
  ];

  const clientLens = storefrontClientScopeLensActive(props.probe);

  if (humansForGrouped.length > 0) {
    return (
      <Flex direction="column" gap="4xl">
        {groupScopeHumanRows(humansForGrouped).map(({ bucket, rows }) => {
          const baselineProfileTitleOnly =
            bucket === "profile" &&
            rows.length > 0 &&
            rows.every((r) => isSyntheticBaselineConsentRow(r));

          return (
            <Flex key={bucket} direction="column" gap="3xl">
              <Text size="sm" weight="semibold">
                {BUCKET_LABEL[bucket]}
              </Text>
              {baselineProfileTitleOnly ? null : (
                <ul {...stylex.props(styles.sectionList)}>
                  {rows.map((row, index) => (
                    <CompactScopeHumanRow
                      key={`${row.token}-${String(index)}`}
                      row={row}
                    />
                  ))}
                </ul>
              )}
            </Flex>
          );
        })}
      </Flex>
    );
  }

  let plainGrouped = groupPlainTokens(plainWithoutBaselineToken);

  if (baselineRequested) {
    plainGrouped = [
      {
        bucket: "profile",
        tokens: [BUCKET_LABEL.profile],
      },
      ...plainGrouped.filter((g) => g.bucket !== "profile"),
    ];
  }

  if (plainGrouped.length > 0) {
    return (
      <Flex direction="column" gap="xl">
        {plainGrouped.map(({ bucket, tokens }) => (
          <Flex key={bucket} direction="column" gap="xs">
            <Text size="sm" weight="medium">
              {BUCKET_LABEL[bucket]}
            </Text>
            {bucket === "profile" &&
            tokens.length === 1 &&
            tokens[0] === BUCKET_LABEL.profile ? null : (
              <SmallBody
                {...(bucket === "profile"
                  ? { variant: "secondary" as const }
                  : {
                      variant: "secondary" as const,
                      style: styles.tokenCommaList,
                    })}
              >
                {tokens.join(", ")}
              </SmallBody>
            )}
          </Flex>
        ))}
      </Flex>
    );
  }

  return (
    <Body variant="secondary">
      {clientLens
        ? "No scope tokens were found in OAuth client_metadata for this app."
        : "No declarative scopes were found on this origin."}
    </Body>
  );
}

/** Matches privacy/terms link pills; opens OAuth / AT Proto permission details. */
export function ListingOAuthScopesPopoverChip(props: {
  storefrontUrl: string;
  oauthProbe: DirectoryListingOAuthProbe | null;
}) {
  const elevated = Boolean(
    props.oauthProbe &&
    oauthProbeClientListsTransitionGeneric(props.oauthProbe),
  );

  const popoverHeading = elevated
    ? "Important: very broad access"
    : "App permissions";

  return (
    <Popover
      placement="bottom start"
      trigger={
        <Button
          slot="trigger"
          aria-haspopup="dialog"
          aria-label="View what this app may access if you connect"
          {...stylex.props(
            styles.scopesLinkChip,
            elevated ? styles.scopesLinkChipElevated : null,
          )}
        >
          <span {...stylex.props(styles.scopesChipInner)}>
            <Shield aria-hidden size={14} strokeWidth={2} />
            <span>Scopes</span>
          </span>
        </Button>
      }
      style={styles.popoverSurface}
    >
      <Flex direction="column" gap="4xl">
        <Flex direction="column" gap="4xl">
          <Text size="lg" weight="semibold">
            {popoverHeading}
          </Text>
          {props.oauthProbe != null &&
          props.oauthProbe.status !== "skipped_no_url" &&
          props.oauthProbe.status !== "error"
            ? storefrontScopesPopoverIntro({
                probe: props.oauthProbe,
              })
            : null}
        </Flex>

        {elevated ? (
          <SmallBody variant="critical">
            Client metadata asks for{" "}
            <span {...stylex.props(styles.tokenChip)}>transition:generic</span>{" "}
            — similar to legacy <strong>app passwords</strong>. Only continue if
            you trust this app.
          </SmallBody>
        ) : null}

        {props.oauthProbe == null ? (
          <Body variant="secondary">
            Nothing recorded yet — check back after the next crawl.
          </Body>
        ) : props.oauthProbe.status === "skipped_no_url" ? (
          <Body variant="secondary">No URL was available to scan.</Body>
        ) : props.oauthProbe.status === "error" ? (
          <Flex direction="column" gap="sm">
            <Body variant="critical">Could not fetch OAuth metadata.</Body>
            <SmallBody variant="secondary">
              {props.oauthProbe.probeError?.trim() ||
                "Unreachable host or crawl error."}
            </SmallBody>
          </Flex>
        ) : (
          <>
            <Separator />
            {storefrontScopesPopoverBody({ probe: props.oauthProbe })}
          </>
        )}

        {props.oauthProbe == null ||
        props.oauthProbe.status === "skipped_no_url" ? null : (
          <SmallBody style={styles.metaFooter} variant="secondary">
            Last sampled {formatProbedAt(props.oauthProbe.probedAt)}
          </SmallBody>
        )}
      </Flex>
    </Popover>
  );
}
