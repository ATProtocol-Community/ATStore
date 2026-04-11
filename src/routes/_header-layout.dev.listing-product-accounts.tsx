import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, createLink, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Checkbox } from "../design-system/checkbox";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { TextField } from "../design-system/text-field";
import { criticalColor, uiColor } from "../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
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
  "/_header-layout/dev/listing-product-accounts",
)({
  loader: async ({ context }) => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }

    await Promise.all([
      context.queryClient.prefetchQuery(
        directoryListingApi.getPendingProductAccountCandidatesQueryOptions,
      ),
      context.queryClient.prefetchQuery(
        directoryListingApi.getListingsMissingProductAccountHandleQueryOptions,
      ),
    ]);
  },
  component: DevListingProductAccountsPage,
});

const AppLink = createLink(Link);
const ProductLink = createLink(Link);

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  pageContent: {
    gap: gap["6xl"],
  },
  pageHeader: {
    gap: gap["4xl"],
    maxWidth: "56rem",
  },
  navLinks: {
    flexWrap: "wrap",
    gap: gap.xl,
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
});

function profileUrl(didOrHandle: string) {
  const actor = didOrHandle.trim().replace(/^@/, "");
  return `https://bsky.app/profile/${encodeURIComponent(actor)}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function DevListingProductAccountsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: rows, isFetching } = useQuery({
    ...directoryListingApi.getPendingProductAccountCandidatesQueryOptions,
  });

  const { data: missingHandleRows, isFetching: missingHandleFetching } =
    useQuery({
      ...directoryListingApi.getListingsMissingProductAccountHandleQueryOptions,
    });

  const saveHandleMutation = useMutation({
    mutationFn: (vars: { listingId: string; handle?: string; did?: string }) =>
      directoryListingApi.setProductAccountHandleDev({ data: vars }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey:
          directoryListingApi.getListingsMissingProductAccountHandleQueryOptions
            .queryKey,
      });
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

  return (
    <HeaderLayout.Page>
      <Page.Root variant="large" style={styles.page}>
        <Flex direction="column" style={styles.pageContent}>
          <Flex style={styles.navLinks}>
            <AppLink to="/dev/app-tags">App tags</AppLink>
            <AppLink to="/dev/categories">Categories</AppLink>
            <AppLink to="/">Home</AppLink>
          </Flex>

          <Flex direction="column" style={styles.pageHeader}>
            <Heading1>Product Bluesky account</Heading1>
            <Body style={styles.meta}>
              All pending candidates are listed below. Check each row to publish{" "}
              <code>productAccountDid</code> for that listing; unchecked rows
              are rejected. Use the button at the bottom to apply everything at
              once.
            </Body>
          </Flex>

          <Flex direction="column" gap="xl" style={styles.pageHeader}>
            <Heading2>Missing handle (@unknown on /apps/tags)</Heading2>
            <Body style={styles.meta}>
              Listings with no stored Bluesky handle (empty or whitespace only).
              You can manually save handle and/or DID to Postgres only; the
              ATProto listing record still uses <code>productAccountDid</code>{" "}
              when set.
            </Body>
            {missingHandleFetching && !missingHandleRows?.length ? (
              <SmallBody>Loading…</SmallBody>
            ) : !missingHandleRows?.length ? (
              <Card style={styles.rowCard}>
                <Body>
                  Every listing has a non-empty handle in the database.
                </Body>
              </Card>
            ) : (
              <Flex direction="column" style={styles.list}>
                {missingHandleRows.map((listing) => (
                  <MissingHandleRow
                    key={listing.id}
                    errorMessage={
                      saveHandleMutation.isError &&
                      saveHandleMutation.variables?.listingId === listing.id
                        ? saveHandleMutation.error instanceof Error
                          ? saveHandleMutation.error.message
                          : String(saveHandleMutation.error)
                        : undefined
                    }
                    isSaving={pendingSaveId === listing.id}
                    listing={listing}
                    onSave={(listingId, payload) => {
                      saveHandleMutation.mutate({ listingId, ...payload });
                    }}
                  />
                ))}
              </Flex>
            )}
          </Flex>

          {error ? (
            <Text size="sm" style={styles.errorText}>
              {error}
            </Text>
          ) : null}

          {isFetching && !rows?.length ? (
            <SmallBody>Loading…</SmallBody>
          ) : !rows?.length ? (
            <Card style={styles.rowCard}>
              <Body>No pending candidates. Run </Body>
              <code>pnpm discover:product-bsky</code>
              <Body> to enqueue.</Body>
            </Card>
          ) : (
            <>
              <Flex direction="column" style={styles.list}>
                {rows.map((item) => (
                  <CandidateRow
                    key={item.candidateId}
                    item={item}
                    isSelected={selected[item.candidateId] !== false}
                    onSelectedChange={(value) => {
                      setSelected((s) => ({
                        ...s,
                        [item.candidateId]: value,
                      }));
                    }}
                  />
                ))}
              </Flex>

              <Flex direction="column" style={styles.footer}>
                <SmallBody style={styles.meta}>
                  Confirms all checked rows on the store PDS; rejects every
                  unchecked pending candidate (failed confirms stay pending for
                  a later run).
                </SmallBody>
                <Button
                  isDisabled={busy || !rows.length}
                  isPending={busy}
                  onPress={() => void onApplyBatch()}
                >
                  Confirm checked &amp; reject others
                </Button>
              </Flex>
            </>
          )}
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}

function MissingHandleRow({
  listing,
  onSave,
  isSaving,
  errorMessage,
}: {
  listing: ListingMissingProductAccountHandleItem;
  onSave: (
    listingId: string,
    payload: { handle?: string; did?: string },
  ) => void;
  isSaving: boolean;
  errorMessage?: string;
}) {
  const [handleValue, setHandleValue] = useState("");
  const [didValue, setDidValue] = useState("");
  const canSave = Boolean(handleValue.trim() || didValue.trim());

  return (
    <Card style={styles.rowCard}>
      <Flex align="start" gap="xl" style={styles.rowInner} wrap>
        <Avatar
          alt={listing.name}
          fallback={getInitials(listing.name)}
          size="lg"
          src={listing.iconUrl ?? undefined}
        />
        <Flex direction="column" gap="sm" style={styles.rowMain}>
          <Text size="lg" weight="semibold">
            {listing.name}
          </Text>
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
          </SmallBody>
          <Flex style={styles.handleFieldRow}>
            <TextField
              label="Bluesky handle"
              onChange={setHandleValue}
              placeholder="e.g. myproduct.bsky.social"
              style={styles.handleInput}
              value={handleValue}
            />
            <TextField
              label="Bluesky DID"
              onChange={setDidValue}
              placeholder="e.g. did:plc:abc123..."
              style={styles.handleInput}
              value={didValue}
            />
            <Button
              isDisabled={!canSave || isSaving}
              isPending={isSaving}
              onPress={() =>
                onSave(listing.id, {
                  did: didValue.trim() || undefined,
                  handle: handleValue.trim() || undefined,
                })
              }
            >
              Save account info
            </Button>
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
