import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, createLink } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { UserHandleAutocomplete } from "../components/user-handle-autocomplete";
import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Checkbox } from "../design-system/checkbox";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { Switch } from "../design-system/switch";
import { criticalColor, uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  Body,
  Heading1,
  Heading2,
  SmallBody,
} from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type ListingMissingProductAccountHandleItem,
  type ProductAccountCandidateQueueItem,
} from "../integrations/tanstack-query/api-directory-listings.functions";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/listing-product-accounts",
)({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.prefetchQuery(
        directoryListingApi.getPendingProductAccountCandidatesQueryOptions,
      ),
      context.queryClient.prefetchQuery(
        directoryListingApi.getListingsMissingProductAccountHandleQueryOptions(),
      ),
    ]);
  },
  component: AdminListingProductAccountsPage,
});

const ProductLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "60rem",
  },
  pageContent: {
    gap: gap["6xl"],
  },
  pageHeader: {
    gap: gap["4xl"],
    maxWidth: "56rem",
  },
  list: {
    gap: gap["2xl"],
    maxWidth: "56rem",
    width: "100%",
  },
  rowCard: {
    borderRadius: radius.xl,
    boxShadow: shadow.md,
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  rowInner: {
    gap: gap["3xl"],
  },
  rowMain: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    gap: gap["lg"],
    minWidth: 0,
  },
  textColumn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  handleFieldRow: {
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: gap.lg,
    maxWidth: "36rem",
    width: "100%",
  },
  handleInput: {
    flexGrow: 1,
    minWidth: "12rem",
  },
  meta: {
    color: uiColor.text2,
  },
  errorText: {
    color: criticalColor.text1,
  },
  footer: {
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    gap: gap["2xl"],
    maxWidth: "56rem",
    paddingTop: verticalSpace["3xl"],
    width: "100%",
  },
  toggleRow: {
    gap: gap.lg,
  },
  ignoredCard: {
    opacity: 0.7,
  },
  ignoredBadge: {
    color: uiColor.text2,
  },
});

function profileUrl(didOrHandle: string) {
  const actor = didOrHandle.trim().replace(/^@/, "");
  return `https://bsky.app/profile/${encodeURIComponent(actor)}`;
}

function guessDomainHandleFromUrl(rawUrl: string | null | undefined) {
  const raw = rawUrl?.trim();
  if (!raw) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw)
    ? raw
    : `https://${raw}`;
  try {
    const host = new URL(withProtocol).hostname.trim().toLowerCase();
    const normalizedHost = host.replace(/\.$/, "").replace(/^www\./, "");
    if (!normalizedHost || /\s/.test(normalizedHost)) {
      return null;
    }
    return normalizedHost;
  } catch {
    return null;
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function AdminListingProductAccountsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showIgnored, setShowIgnored] = useState(false);

  const { data: rows, isFetching } = useQuery({
    ...directoryListingApi.getPendingProductAccountCandidatesQueryOptions,
  });

  const {
    data: missingHandleRows,
    isFetching: missingHandleFetching,
    isError: isMissingHandleError,
    error: missingHandleError,
  } = useQuery({
    ...directoryListingApi.getListingsMissingProductAccountHandleQueryOptions({
      includeIgnored: showIgnored,
    }),
  });

  const invalidateMissingHandleQueries = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["storeListings", "dev", "listingsMissingProductAccountHandle"],
    });
  };

  const saveHandleMutation = useMutation({
    mutationFn: (vars: { listingId: string; handle?: string }) =>
      directoryListingApi.setProductAccountHandleDev({ data: vars }),
    onSuccess: async () => {
      await invalidateMissingHandleQueries();
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
  });
  const ignoreMissingHandleMutation = useMutation({
    mutationFn: (vars: { listingId: string }) =>
      directoryListingApi.ignoreMissingProductAccountHandleDev({ data: vars }),
    onSuccess: async () => {
      await invalidateMissingHandleQueries();
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
  });
  const unignoreMissingHandleMutation = useMutation({
    mutationFn: (vars: { listingId: string }) =>
      directoryListingApi.unignoreMissingProductAccountHandleDev({
        data: vars,
      }),
    onSuccess: async () => {
      await invalidateMissingHandleQueries();
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    },
  });

  useEffect(() => {
    if (!rows?.length) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.candidateId] === undefined) {
          next[r.candidateId] = true;
        }
      }
      return next;
    });
  }, [rows]);

  async function refreshQueue() {
    await queryClient.invalidateQueries({
      queryKey: ["storeListings", "dev", "pendingProductAccountCandidates"],
    });
    await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
  }

  async function onApplyBatch() {
    if (!rows?.length) return;
    setBusy(true);
    setError(null);
    try {
      const confirmCandidateIds = rows
        .filter((r) => selected[r.candidateId] === true)
        .map((r) => r.candidateId);
      await directoryListingApi.applyProductAccountCandidatesBatch({
        data: { confirmCandidateIds },
      });
      setSelected({});
      await refreshQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const pendingSaveId =
    saveHandleMutation.isPending && saveHandleMutation.variables
      ? saveHandleMutation.variables.listingId
      : null;
  const pendingIgnoreId =
    ignoreMissingHandleMutation.isPending &&
    ignoreMissingHandleMutation.variables
      ? ignoreMissingHandleMutation.variables.listingId
      : null;
  const pendingUnignoreId =
    unignoreMissingHandleMutation.isPending &&
    unignoreMissingHandleMutation.variables
      ? unignoreMissingHandleMutation.variables.listingId
      : null;

  const ignoredCount =
    missingHandleRows?.filter((r) => r.productAccountHandleIgnoredAt).length ??
    0;

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Flex direction="column" style={styles.pageContent}>
          <Flex direction="column" style={styles.pageHeader}>
            <Heading1>Product Bluesky account</Heading1>
          </Flex>

          <Flex direction="column" gap="xl" style={styles.pageHeader}>
            <Heading2>Missing handle for any listing</Heading2>
            <Body style={styles.meta}>
              Listings with no stored Bluesky handle (empty or whitespace only).
              Enter a handle and this page will resolve the DID for you before
              saving to Postgres.
            </Body>
            <Flex align="center" style={styles.toggleRow}>
              <Switch isSelected={showIgnored} onChange={setShowIgnored}>
                Show ignored listings
                {showIgnored && ignoredCount > 0 ? ` (${ignoredCount})` : null}
              </Switch>
            </Flex>
            {missingHandleFetching && !missingHandleRows?.length ? (
              <SmallBody>Loading…</SmallBody>
            ) : isMissingHandleError ? (
              <Card style={styles.rowCard}>
                <Text size="sm" style={styles.errorText}>
                  {missingHandleError instanceof Error
                    ? missingHandleError.message
                    : String(missingHandleError)}
                </Text>
              </Card>
            ) : !missingHandleRows?.length ? (
              <Card style={styles.rowCard}>
                <Body>
                  {showIgnored
                    ? "No listings are missing a handle."
                    : "Every listing has a non-empty handle, or the remaining ones are ignored."}
                </Body>
              </Card>
            ) : (
              <Flex direction="column" style={styles.list}>
                {missingHandleRows.map((listing) => {
                  const rowError =
                    saveHandleMutation.isError &&
                    saveHandleMutation.variables?.listingId === listing.id
                      ? saveHandleMutation.error
                      : ignoreMissingHandleMutation.isError &&
                          ignoreMissingHandleMutation.variables?.listingId ===
                            listing.id
                        ? ignoreMissingHandleMutation.error
                        : unignoreMissingHandleMutation.isError &&
                            unignoreMissingHandleMutation.variables
                              ?.listingId === listing.id
                          ? unignoreMissingHandleMutation.error
                          : undefined;
                  return (
                    <MissingHandleRow
                      key={listing.id}
                      errorMessage={
                        rowError
                          ? rowError instanceof Error
                            ? rowError.message
                            : String(rowError)
                          : undefined
                      }
                      isIgnoring={pendingIgnoreId === listing.id}
                      isSaving={pendingSaveId === listing.id}
                      isUnignoring={pendingUnignoreId === listing.id}
                      listing={listing}
                      onIgnore={(listingId) => {
                        ignoreMissingHandleMutation.mutate({ listingId });
                      }}
                      onSave={(listingId, payload) => {
                        saveHandleMutation.mutate({ listingId, ...payload });
                      }}
                      onUnignore={(listingId) => {
                        unignoreMissingHandleMutation.mutate({ listingId });
                      }}
                    />
                  );
                })}
              </Flex>
            )}
          </Flex>

          {error ? (
            <Text size="sm" style={styles.errorText}>
              {error}
            </Text>
          ) : null}
        </Flex>
      </Flex>
    </Page.Root>
  );
}

function MissingHandleRow({
  listing,
  onSave,
  onIgnore,
  onUnignore,
  isSaving,
  isIgnoring,
  isUnignoring,
  errorMessage,
}: {
  listing: ListingMissingProductAccountHandleItem;
  onSave: (listingId: string, payload: { handle?: string }) => void;
  onIgnore: (listingId: string) => void;
  onUnignore: (listingId: string) => void;
  isSaving: boolean;
  isIgnoring: boolean;
  isUnignoring: boolean;
  errorMessage?: string;
}) {
  const [handleValue, setHandleValue] = useState("");
  const canSave = Boolean(handleValue.trim());
  const attemptDomainHandle = guessDomainHandleFromUrl(listing.externalUrl);
  const isIgnored = Boolean(listing.productAccountHandleIgnoredAt);

  return (
    <Card style={[styles.rowCard, isIgnored && styles.ignoredCard]}>
      <Flex align="start" gap="xl" style={styles.rowInner} wrap>
        <Avatar
          alt={listing.name}
          fallback={getInitials(listing.name)}
          size="lg"
          src={listing.iconUrl ?? undefined}
        />
        <Flex direction="column" gap="sm" style={styles.rowMain}>
          <Flex align="center" gap="md" wrap>
            <Text size="lg" weight="semibold">
              {listing.name}
            </Text>
            {isIgnored ? (
              <SmallBody style={styles.ignoredBadge}>· Ignored</SmallBody>
            ) : null}
          </Flex>
          <SmallBody style={styles.meta}>
            <ProductLink
              params={{ productId: listing.slug }}
              to="/products/$productId"
            >
              /products/{listing.slug}
            </ProductLink>
            {listing.productAccountDid ? (
              <>
                {" "}
                ·{" "}
                <a
                  href={profileUrl(listing.productAccountDid)}
                  rel="noreferrer"
                  target="_blank"
                >
                  DID on file
                </a>
              </>
            ) : (
              <> · no product DID</>
            )}
            {attemptDomainHandle ? (
              <>
                {" "}
                ·{" "}
                <a
                  href={profileUrl(attemptDomainHandle)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Attempt @{attemptDomainHandle}
                </a>
              </>
            ) : null}
          </SmallBody>
          <Flex style={styles.handleFieldRow}>
            <Flex style={styles.handleInput}>
              <UserHandleAutocomplete
                label="Bluesky handle"
                onValueChange={setHandleValue}
                placeholder="e.g. myproduct.bsky.social"
                value={handleValue}
              />
            </Flex>
            <Button
              isDisabled={
                !attemptDomainHandle ||
                isSaving ||
                isIgnoring ||
                isUnignoring ||
                handleValue.trim() === attemptDomainHandle
              }
              onPress={() => {
                if (attemptDomainHandle) {
                  setHandleValue(attemptDomainHandle);
                }
              }}
              variant="secondary"
            >
              Use attempt
            </Button>
            <Button
              isDisabled={!canSave || isSaving || isUnignoring}
              isPending={isSaving}
              onPress={() =>
                onSave(listing.id, {
                  handle: handleValue.trim() || undefined,
                })
              }
            >
              Save handle
            </Button>
            {isIgnored ? (
              <Button
                isDisabled={isSaving || isUnignoring}
                isPending={isUnignoring}
                onPress={() => onUnignore(listing.id)}
                variant="secondary"
              >
                Un-ignore
              </Button>
            ) : (
              <Button
                isDisabled={isSaving || isIgnoring}
                isPending={isIgnoring}
                onPress={() => onIgnore(listing.id)}
                variant="secondary"
              >
                Ignore listing
              </Button>
            )}
          </Flex>
          {errorMessage ? (
            <Text size="sm" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}
        </Flex>
      </Flex>
    </Card>
  );
}

function CandidateRow({
  item,
  isSelected,
  onSelectedChange,
}: {
  item: ProductAccountCandidateQueueItem;
  isSelected: boolean;
  onSelectedChange: (value: boolean) => void;
}) {
  return (
    <Card style={styles.rowCard}>
      <Flex align="start" style={styles.rowInner}>
        <Checkbox
          isSelected={isSelected}
          onChange={onSelectedChange}
          aria-label={`Add Bluesky account for ${item.listingName}`}
        />
        <Flex align="center" gap="lg" style={styles.rowMain}>
          <Avatar
            alt={item.listingName}
            fallback={getInitials(item.listingName)}
            size="lg"
            src={item.iconUrl ?? undefined}
          />
          <Flex direction="column" gap="sm" style={styles.textColumn}>
            <Text size="lg" weight="semibold">
              {item.listingName}
            </Text>
            <SmallBody style={styles.meta}>
              /products/{item.listingSlug} · source: {item.source}
            </SmallBody>
            <Body>
              <strong>DID:</strong>{" "}
              <a
                href={profileUrl(item.candidateDid)}
                rel="noreferrer"
                target="_blank"
              >
                {item.candidateDid}
              </a>
            </Body>
            {item.candidateHandle ? (
              <Body>
                <strong>Handle:</strong>{" "}
                <a
                  href={profileUrl(item.candidateHandle)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.candidateHandle.startsWith("@")
                    ? item.candidateHandle
                    : `@${item.candidateHandle}`}
                </a>
              </Body>
            ) : null}
            {item.externalUrl ? (
              <Body>
                <strong>External URL:</strong>{" "}
                <a href={item.externalUrl} rel="noreferrer" target="_blank">
                  {item.externalUrl}
                </a>
              </Body>
            ) : null}
          </Flex>
        </Flex>
      </Flex>
    </Card>
  );
}
