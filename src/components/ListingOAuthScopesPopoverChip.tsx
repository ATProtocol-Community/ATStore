"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { RefreshCw, Shield } from "lucide-react";
import { Button } from "react-aria-components";

import type { DirectoryListingOAuthProbe } from "../integrations/tanstack-query/api-directory-listings.functions";
import type { SummaryScopeHumanRow } from "../lib/oauth-listing-auth-probe";
import type { PermissionGrantStructuredLine } from "../lib/oauth-permission-grant-ui";

import { Button as DsButton } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { HoverCard } from "../design-system/hover-card";
import { Separator } from "../design-system/separator";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor, warningColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  lineHeight,
} from "../design-system/theme/typography.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  PERMISSION_GRANT_SECTION_HEADINGS,
  isPermissionGrantSectionGap,
  isPermissionGrantUnorderedList,
} from "../lib/oauth-permission-grant-ui";
import {
  capRepoCollectionConsentLinesForUi,
  humanizeRpcAudienceForScope,
  mergeRepoScopesIntoCollectionConsentLines,
  parseIncludeScopeToken,
  parseRpcScopeForStorefront,
} from "../lib/oauth-scope-include-parse";
import {
  BUCKET_LABEL,
  groupScopeHumanRows,
  isSyntheticBaselineConsentRow,
  listingOAuthScopesPopoverChipShouldRender,
  oauthProbeClientListsTransitionGeneric,
  storefrontClientScopeLensActive,
  storefrontScopesPopoverListInputs,
} from "./ListingOAuthScopesPopoverChip.logic";

const PERMISSION_DETAIL_MAX_LINES = 12;

/** Limits very long unordered lists (records, verbs, RPC names) inside one bundle section. */
const PERMISSION_DETAIL_MAX_ITEMS_PER_ACTION_LIST = 42;

const styles = stylex.create({
  bundlePanel: {
    borderColor: uiColor.border2,
    borderRadius: radius.xs,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: verticalSpace.md,
    paddingInline: horizontalSpace.md,
    backgroundColor: uiColor.bgSubtle,
  },
  bundleStructuredStack: {
    marginBlock: 0,
    marginInline: 0,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  bundleStructuredSectionGap: {
    display: "block",
    flexShrink: 0,
    marginBlockStart: verticalSpace["lg"],
  },
  bundleDetail: {
    marginBlock: 0,
    marginInline: 0,
    borderBlockEndColor: uiColor.border2,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: 1,
    display: "block",
    paddingBlockEnd: verticalSpace.xl,
    minWidth: 0,
  },
  bundleLineBlock: {
    display: "block",
    paddingBlockEnd: verticalSpace.xl,
    minWidth: 0,
  },
  bundleLineBlockLast: {
    paddingBlockEnd: 0,
  },
  bundleLineText: {
    display: "block",
  },
  bundleLabeledGroupList: {
    marginBlock: 0,
    marginInline: 0,
    listStyleType: "none",
    paddingInlineStart: horizontalSpace.lg,
  },
  bundleLabeledGroupItem: {
    gap: gap.sm,
    display: "flex",
    flexDirection: "column",
  },
  bundleNestedItemText: {
    display: "block",
    fontFamily: fontFamily.mono,
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },
  bundleNestedList: {
    gap: verticalSpace.sm,
    marginBlock: 0,
    display: "flex",
    flexDirection: "column",
    listStylePosition: "outside",
    listStyleType: "disc",
    marginInlineEnd: 0,
    marginInlineStart: horizontalSpace.sm,
    paddingInlineStart: horizontalSpace.lg,
  },
  bundleTokenFooter: {
    borderBlockStartColor: uiColor.border2,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: 1,
    marginBlockStart: verticalSpace.sm,
    paddingBlockStart: verticalSpace.sm,
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
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
  },
  header: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    borderBottomColor: uiColor.border2,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    height: size["4xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
  },
  content: {
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["4xl"],
  },
  scopesLinkChip: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    color: uiColor.text2,
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: 500,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    height: 30,
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
    gap: verticalSpace.xl,
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
  repoScopesRecordsWrap: {
    gap: gap.xs,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  repoScopesCollectionList: {
    gap: verticalSpace.sm,
    marginBlock: 0,
    display: "flex",
    flexDirection: "column",
    listStylePosition: "outside",
    listStyleType: "disc",
    marginInlineEnd: 0,
    marginInlineStart: horizontalSpace.sm,
    paddingInlineStart: horizontalSpace.lg,
    minWidth: 0,
  },
  repoConsentCollectionLine: {
    gap: verticalSpace.sm,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  repoCollectionVerbPhrase: {
    fontFamily: fontFamily.sans,
    whiteSpace: "pre-wrap",
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

function coerceStructuredLine(
  raw: unknown,
): PermissionGrantStructuredLine | undefined {
  if (typeof raw === "string") {
    return raw;
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }

  const o = raw as Record<string, unknown>;
  if (o.kind === "sectionGap") {
    return { kind: "sectionGap" };
  }
  if (o.kind !== "unorderedList") return undefined;
  if (typeof o.label !== "string" || !o.label.trim()) return undefined;
  if (!Array.isArray(o.items)) return undefined;

  const items = o.items.flatMap((x) => {
    if (typeof x === "string") {
      const t = x.trim();
      return t ? [t] : [];
    }
    if (typeof x === "number" && Number.isFinite(x)) return [String(x)];
    return [];
  });

  if (items.length === 0) return undefined;

  return { kind: "unorderedList", label: o.label.trim(), items };
}

function bundleStructuredLines(
  row: SummaryScopeHumanRow,
): Array<PermissionGrantStructuredLine> {
  const raw =
    "includePermissionSet" in row
      ? row.includePermissionSet.structuredLines
      : [];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const normalized = coerceStructuredLine(x);
    return normalized === undefined ? [] : [normalized];
  });
}

function clippedBundleStructuredLines(
  lines: ReadonlyArray<PermissionGrantStructuredLine>,
): Array<PermissionGrantStructuredLine> {
  if (lines.length <= PERMISSION_DETAIL_MAX_LINES) return [...lines];
  return [...lines.slice(0, PERMISSION_DETAIL_MAX_LINES), "…"];
}

function unorderedListDisplayItems(
  items: ReadonlyArray<string>,
): Array<string> {
  const cap = PERMISSION_DETAIL_MAX_ITEMS_PER_ACTION_LIST;
  if (items.length <= cap) return [...items];
  return [...items.slice(0, cap - 1), "…"];
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

/** Consolidates repo probe rows — explicit actions only annotate the collections from the same token */
function MergedRepoScopesListItem({
  rows,
}: {
  rows: ReadonlyArray<SummaryScopeHumanRow>;
}) {
  const consentLines = mergeRepoScopesIntoCollectionConsentLines(
    rows.map((r) => r.token.trim()).filter(Boolean),
  );
  const capped = capRepoCollectionConsentLinesForUi(consentLines);

  const ariaScopes = [...new Set(rows.map((r) => r.token.trim()))]
    .filter(Boolean)
    .join(" · ");

  return (
    <li aria-label={`OAuth repo scopes · ${ariaScopes}`}>
      <Flex direction="column" gap="sm" style={styles.scopeRowInner}>
        {consentLines.length === 0 ? (
          <Text size="xs" variant="secondary">
            Published metadata doesn&apos;t spell out record collections here.
          </Text>
        ) : (
          <div {...stylex.props(styles.repoScopesRecordsWrap)}>
            <ul {...stylex.props(styles.repoScopesCollectionList)}>
              {capped.items.map((line) => (
                <li key={line.nsid}>
                  <Text
                    size="xs"
                    variant="secondary"
                    style={styles.repoConsentCollectionLine}
                  >
                    <span {...stylex.props(styles.bundleNestedItemText)}>
                      {line.nsid}
                    </span>
                    {line.verbPhrase ? (
                      <span {...stylex.props(styles.repoCollectionVerbPhrase)}>
                        {" "}
                        {line.verbPhrase}
                      </span>
                    ) : null}
                  </Text>
                </li>
              ))}
            </ul>
            {capped.moreCount > 0 ? (
              <Text size="xs" variant="secondary">
                +{String(capped.moreCount)} more
              </Text>
            ) : null}
          </div>
        )}
      </Flex>
    </li>
  );
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
  const clipped = clippedBundleStructuredLines(lines);

  const nsid = resolved?.nsid ?? unresolved?.nsid ?? includeScope?.nsid ?? null;

  const headline =
    (resolved?.title?.trim() ? resolved.title.trim() : null) ??
    (nsid ? readableNameFromBundleNsid(nsid) : null);

  const detail = resolved?.detail?.trim() ? resolved.detail.trim() : null;

  if (!isBundleRow) {
    const rpcStandalone = parseRpcScopeForStorefront(row.token.trim());
    if (rpcStandalone) {
      const methodItems =
        rpcStandalone.lxmsSorted.length > 0
          ? unorderedListDisplayItems([...rpcStandalone.lxmsSorted])
          : [];
      let serviceLine: string | null = null;
      const { aud } = rpcStandalone;
      if (aud === "*") {
        serviceLine =
          "Service audience: Any delegated Bluesky service (not narrowed to one host DID).";
      } else if (aud?.trim()) {
        const nice = humanizeRpcAudienceForScope(aud);
        serviceLine =
          nice === aud ? `Service audience: ${aud}` : `Service: ${nice}`;
      }

      return (
        <li>
          <Flex direction="column" gap="lg" style={styles.scopeRowInner}>
            {serviceLine === null ? null : (
              <SmallBody variant="secondary">{serviceLine}</SmallBody>
            )}
            {methodItems.length > 0 ? (
              <Flex direction="column" gap="sm">
                <Text size="xs" weight="semibold" variant="secondary">
                  Can Access:
                </Text>
                <ul {...stylex.props(styles.bundleNestedList)}>
                  {methodItems.map((entry, ix) => (
                    <li key={`rpc-lxm-${entry.slice(0, 48)}-${String(ix)}`}>
                      <Text
                        size="xs"
                        variant="secondary"
                        style={styles.bundleNestedItemText}
                      >
                        {entry}
                      </Text>
                    </li>
                  ))}
                </ul>
              </Flex>
            ) : null}
          </Flex>
        </li>
      );
    }

    return (
      <li>
        <Flex direction="column" gap="lg" style={styles.scopeRowInner}>
          <SmallBody style={styles.tokenChip}>{row.token}</SmallBody>
          {row.description.trim().length > 0 ? (
            <Text size="xs" variant="secondary">
              {row.description}
            </Text>
          ) : null}
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
        {detail ? (
          <div {...stylex.props(styles.bundleDetail)}>
            <SmallBody variant="secondary">{detail}</SmallBody>
          </div>
        ) : null}
        {clipped.length > 0 ? (
          <div {...stylex.props(styles.bundleStructuredStack)}>
            {clipped.map((line, index) =>
              isPermissionGrantSectionGap(line) ? (
                <div
                  aria-hidden
                  key={`bundle-section-gap-${String(index)}`}
                  {...stylex.props(styles.bundleStructuredSectionGap)}
                />
              ) : typeof line === "string" ? (
                <div
                  key={`bundle-${line.slice(0, 48)}-${String(index)}`}
                  {...stylex.props(
                    styles.bundleLineBlock,
                    index === clipped.length - 1
                      ? styles.bundleLineBlockLast
                      : null,
                  )}
                >
                  <Text
                    size="sm"
                    variant="secondary"
                    weight={
                      PERMISSION_GRANT_SECTION_HEADINGS.has(line)
                        ? "semibold"
                        : undefined
                    }
                    style={styles.bundleLineText}
                  >
                    {line}
                  </Text>
                </div>
              ) : isPermissionGrantUnorderedList(line) ? (
                <div
                  key={`bundle-ul-${line.label}-${String(index)}`}
                  {...stylex.props(
                    styles.bundleLineBlock,
                    index === clipped.length - 1
                      ? styles.bundleLineBlockLast
                      : null,
                  )}
                >
                  <ul {...stylex.props(styles.bundleLabeledGroupList)}>
                    <li {...stylex.props(styles.bundleLabeledGroupItem)}>
                      <Text
                        size="sm"
                        weight="semibold"
                        variant="secondary"
                        style={styles.bundleLineText}
                      >
                        {line.label}
                      </Text>
                      <ul {...stylex.props(styles.bundleNestedList)}>
                        {unorderedListDisplayItems(line.items).map(
                          (entry, nestedIndex) => (
                            <li
                              key={`${line.label}-item-${entry.slice(0, 56)}-${String(nestedIndex)}`}
                            >
                              <Text
                                size="xs"
                                variant="secondary"
                                style={styles.bundleNestedItemText}
                              >
                                {entry}
                              </Text>
                            </li>
                          ),
                        )}
                      </ul>
                    </li>
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
        {unresolved?.reason?.trim() ? (
          <SmallBody variant="secondary">{unresolved.reason}</SmallBody>
        ) : null}
        <div {...stylex.props(styles.bundleTokenFooter)}>
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
  const { humansForGrouped, plainGrouped } = storefrontScopesPopoverListInputs(
    props.probe,
  );

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
                  {bucket === "repo" ? (
                    <MergedRepoScopesListItem
                      key={`${bucket}-merged`}
                      rows={rows}
                    />
                  ) : (
                    rows.map((row, index) => (
                      <CompactScopeHumanRow
                        key={`${row.token}-${String(index)}`}
                        row={row}
                      />
                    ))
                  )}
                </ul>
              )}
            </Flex>
          );
        })}
      </Flex>
    );
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
  /** When set in dev, shows a control to re-run the storefront OAuth probe and refresh listing data. */
  devListingId?: string;
  devListingSlug?: string | null;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const rescanOAuthProbeDev = useMutation({
    mutationFn: async () => {
      const listingId = props.devListingId?.trim();
      if (!listingId) {
        throw new Error("Listing id missing.");
      }
      return directoryListingApi.rescanListingOAuthProbeDev({
        data: { listingId },
      });
    },
    onSuccess: async () => {
      const id = props.devListingId?.trim();
      const slug = props.devListingSlug?.trim();
      if (id) {
        await queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getDirectoryListingDetailQueryOptions(id)
              .queryKey,
        });
      }
      if (slug) {
        await queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getDirectoryListingDetailBySlugQueryOptions(
              slug,
            ).queryKey,
        });
      }
      await router.invalidate();
    },
  });

  const showDevRescan =
    import.meta.env.DEV && Boolean(props.devListingId?.trim());

  const elevated = Boolean(
    props.oauthProbe &&
    oauthProbeClientListsTransitionGeneric(props.oauthProbe),
  );

  const popoverHeading = elevated
    ? "Important: very broad access"
    : "App permissions";

  if (
    !listingOAuthScopesPopoverChipShouldRender({
      oauthProbe: props.oauthProbe,
    })
  ) {
    return null;
  }

  return (
    <HoverCard
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
      <Flex direction="column">
        <Flex gap="4xl" style={styles.header}>
          <Text size="base" weight="semibold">
            {popoverHeading}
          </Text>
        </Flex>

        <Flex direction="column" gap="4xl" style={styles.content}>
          {props.oauthProbe != null &&
          props.oauthProbe.status !== "skipped_no_url" &&
          props.oauthProbe.status !== "error"
            ? storefrontScopesPopoverIntro({
                probe: props.oauthProbe,
              })
            : null}

          {elevated ? (
            <SmallBody variant="critical">
              Client metadata asks for{" "}
              <span {...stylex.props(styles.tokenChip)}>
                transition:generic
              </span>{" "}
              — similar to legacy <strong>app passwords</strong>. Only continue
              if you trust this app.
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

          {showDevRescan ? (
            <>
              <Separator />
              <Flex direction="column" gap="sm">
                <Flex align="center" gap="md" justify="between" wrap>
                  <SmallBody variant="secondary">
                    Dev — re-run the storefront OAuth probe and sync results to
                    the DB.
                  </SmallBody>
                  <DsButton
                    variant="secondary"
                    size="sm"
                    isPending={rescanOAuthProbeDev.isPending}
                    isDisabled={rescanOAuthProbeDev.isPending}
                    onPress={() => rescanOAuthProbeDev.mutate()}
                  >
                    <Flex align="center" gap="xs">
                      <RefreshCw aria-hidden size={14} strokeWidth={2} />
                      Rescan permissions
                    </Flex>
                  </DsButton>
                </Flex>
                {rescanOAuthProbeDev.isError ? (
                  <SmallBody variant="critical">
                    {rescanOAuthProbeDev.error instanceof Error
                      ? rescanOAuthProbeDev.error.message
                      : "Rescan failed."}
                  </SmallBody>
                ) : null}
              </Flex>
            </>
          ) : null}

          {props.oauthProbe == null ||
          props.oauthProbe.status === "skipped_no_url" ? null : (
            <SmallBody style={styles.metaFooter} variant="secondary">
              Last sampled {formatProbedAt(props.oauthProbe.probedAt)}
            </SmallBody>
          )}
        </Flex>
      </Flex>
    </HoverCard>
  );
}
