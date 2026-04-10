import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink, notFound } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { TextField } from "../design-system/text-field";
import { uiColor } from "../design-system/theme/color.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingAppTagAssignment,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { normalizeAppTag, normalizeAppTags, tagsEqual } from "../lib/app-tags";

export const Route = createFileRoute("/_header-layout/dev/app-tags")({
  loader: async ({ context }) => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }

    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingAppTagAssignmentsQueryOptions,
    );
  },
  component: DevAppTagsPage,
});

const AppLink = createLink(Link);

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
    maxWidth: "52rem",
  },
  statsRow: {
    flexWrap: "wrap",
  },
  statCard: {
    borderRadius: radius.xl,
    boxShadow: shadow.md,
    minWidth: "12rem",
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["3xl"],
  },
  listingList: {
    gap: gap["2xl"],
  },
  listingCard: {
    borderRadius: radius.xl,
    boxShadow: shadow.lg,
  },
  listingCardBody: {
    gap: gap["3xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingMeta: {
    flex: 1,
    minWidth: 0,
  },
  tagRow: {
    flexWrap: "wrap",
  },
  suggestedRow: {
    flexWrap: "wrap",
  },
  helperText: {
    color: uiColor.text2,
    maxWidth: "48rem",
  },
  saveStatus: {
    color: uiColor.text2,
  },
  filterBar: {
    alignItems: "center",
    flexWrap: "wrap",
  },
  chip: {
    alignItems: "center",
    gap: gap["xs"],
  },
});

function formatTagLabel(tag: string) {
  return tag.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function DevAppTagsPage() {
  const queryClient = useQueryClient();
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingAppTagAssignmentsQueryOptions,
  );
  const [draftOverrides, setDraftOverrides] = useState<
    Record<string, string[] | undefined>
  >({});
  const [customInputById, setCustomInputById] = useState<
    Record<string, string>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [showUntaggedOnly, setShowUntaggedOnly] = useState(false);

  const stats = useMemo(() => {
    const tagged = listings.filter(
      (listing) => listing.appTags.length > 0,
    ).length;

    return {
      total: listings.length,
      tagged,
      untagged: listings.length - tagged,
    };
  }, [listings]);

  function getDraft(listing: DirectoryListingAppTagAssignment) {
    return draftOverrides[listing.id] ?? listing.appTags;
  }

  const visibleListings = useMemo(() => {
    return listings
      .filter((listing) =>
        listing.categorySlugs.some((cs) => cs.split("/").length === 2),
      )
      .filter((listing) => {
        if (!showUntaggedOnly) {
          return true;
        }

        return listing.appTags.length === 0;
      });
  }, [listings, showUntaggedOnly, draftOverrides]);

  function setDraft(listingId: string, tags: string[]) {
    setDraftOverrides((current) => ({
      ...current,
      [listingId]: normalizeAppTags(tags),
    }));
  }

  function addTag(listing: DirectoryListingAppTagAssignment, raw: string) {
    const n = normalizeAppTag(raw);
    if (!n) {
      return;
    }

    const current = getDraft(listing);
    if (current.includes(n)) {
      return;
    }

    setDraft(listing.id, [...current, n]);
  }

  function removeTag(listing: DirectoryListingAppTagAssignment, tag: string) {
    const current = getDraft(listing);

    setDraft(
      listing.id,
      current.filter((t) => t !== tag),
    );
  }

  async function saveListing(listing: DirectoryListingAppTagAssignment) {
    const tags = getDraft(listing);
    setSavingId(listing.id);
    setLastSavedId(null);

    try {
      await directoryListingApi.updateDirectoryListingAppTags({
        data: {
          id: listing.id,
          appTags: tags,
        },
      });

      setLastSavedId(listing.id);
      setDraftOverrides((current) => {
        const next = { ...current };
        delete next[listing.id];

        return next;
      });
      setCustomInputById((current) => {
        const next = { ...current };
        delete next[listing.id];

        return next;
      });

      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <HeaderLayout.Page>
      <Page.Root variant="large" style={styles.page}>
        <Flex direction="column" style={styles.pageContent}>
          <Flex gap="xl" style={styles.filterBar}>
            <AppLink to={"/categories/all" as never}>
              Back to categories
            </AppLink>
            <AppLink to="/dev/categories">Recategorize categories</AppLink>
            <AppLink to="/">Home</AppLink>
          </Flex>

          <Flex direction="column" style={styles.pageHeader}>
            <Heading1>App tag categorization</Heading1>
          </Flex>

          <Flex gap="2xl" style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Flex direction="column" gap="sm">
                <SmallBody>Total</SmallBody>
                <Text size="3xl" weight="semibold">
                  {stats.total}
                </Text>
              </Flex>
            </Card>
            <Card style={styles.statCard}>
              <Flex direction="column" gap="sm">
                <SmallBody>Tagged</SmallBody>
                <Text size="3xl" weight="semibold">
                  {stats.tagged}
                </Text>
              </Flex>
            </Card>
            <Card style={styles.statCard}>
              <Flex direction="column" gap="sm">
                <SmallBody>Untagged</SmallBody>
                <Text size="3xl" weight="semibold">
                  {stats.untagged}
                </Text>
              </Flex>
            </Card>
          </Flex>

          <Flex align="center" gap="md" style={styles.filterBar}>
            <Button
              size="sm"
              variant={showUntaggedOnly ? "primary" : "secondary"}
              onPress={() => {
                setShowUntaggedOnly(true);
              }}
            >
              Untagged only
            </Button>
            <Button
              size="sm"
              variant={!showUntaggedOnly ? "primary" : "secondary"}
              onPress={() => {
                setShowUntaggedOnly(false);
              }}
            >
              All listings
            </Button>
          </Flex>

          <Flex direction="column" style={styles.listingList}>
            {visibleListings.length === 0 ? (
              <Card style={styles.listingCard}>
                <Flex
                  direction="column"
                  gap="md"
                  style={styles.listingCardBody}
                >
                  <Text weight="semibold">No listings match this filter</Text>
                  <SmallBody style={styles.helperText}>
                    Switch to &quot;All listings&quot; or tag remaining rows.
                  </SmallBody>
                </Flex>
              </Card>
            ) : null}
            {visibleListings.map((listing) => {
              const draft = getDraft(listing);
              const isSaving = savingId === listing.id;
              const isDirty = !tagsEqual(draft, listing.appTags);
              const suggestedAvailable = listing.suggestedTags.filter(
                (tag) => !draft.includes(tag),
              );
              const customValue = customInputById[listing.id] ?? "";

              return (
                <Card key={listing.id} style={styles.listingCard}>
                  <Flex direction="column" style={styles.listingCardBody}>
                    <Flex gap="2xl" style={styles.listingHeader}>
                      <Avatar
                        alt={listing.name}
                        fallback={getInitials(listing.name)}
                        size="xl"
                        src={listing.iconUrl || undefined}
                      />
                      <Flex
                        direction="column"
                        gap="md"
                        style={styles.listingMeta}
                      >
                        <Text size="xl" weight="semibold">
                          {listing.name}
                        </Text>
                        <Body variant="secondary">{listing.tagline}</Body>
                        {listing.externalUrl ? (
                          <Link href={listing.externalUrl}>
                            Open external URL
                          </Link>
                        ) : (
                          <SmallBody style={styles.helperText}>
                            No resolved external URL yet.
                          </SmallBody>
                        )}
                        <SmallBody style={styles.helperText}>
                          Category:{" "}
                          {listing.categorySlugs.length > 0
                            ? listing.categorySlugs.join(", ")
                            : "—"}
                        </SmallBody>
                      </Flex>
                    </Flex>

                    <Flex direction="column" gap="sm">
                      <Text weight="semibold">Tags</Text>
                      <Flex gap="sm" style={styles.tagRow}>
                        {draft.length === 0 ? (
                          <SmallBody style={styles.helperText}>
                            No tags yet.
                          </SmallBody>
                        ) : null}
                        {draft.map((tag) => (
                          <Button
                            key={tag}
                            size="sm"
                            variant="tertiary"
                            onPress={() => {
                              removeTag(listing, tag);
                            }}
                          >
                            <Flex align="center" gap="xs" style={styles.chip}>
                              <span>{formatTagLabel(tag)}</span>
                              <X aria-hidden size={14} />
                            </Flex>
                          </Button>
                        ))}
                      </Flex>
                    </Flex>

                    <Flex direction="column" gap="sm">
                      <Text weight="semibold">Suggested</Text>
                      {suggestedAvailable.length === 0 ? (
                        <SmallBody style={styles.helperText}>
                          No suggestions left, or add a custom tag below.
                        </SmallBody>
                      ) : (
                        <Flex gap="sm" style={styles.suggestedRow}>
                          {suggestedAvailable.map((tag) => (
                            <Button
                              key={tag}
                              size="sm"
                              variant="secondary"
                              onPress={() => {
                                addTag(listing, tag);
                              }}
                            >
                              + {formatTagLabel(tag)}
                            </Button>
                          ))}
                        </Flex>
                      )}
                    </Flex>

                    <Flex align="end" gap="md">
                      <TextField
                        label="Add custom tag"
                        value={customValue}
                        onChange={(value) => {
                          setCustomInputById((current) => ({
                            ...current,
                            [listing.id]: value,
                          }));
                        }}
                        placeholder="e.g. analytics"
                      />
                      <Button
                        size="md"
                        variant="secondary"
                        onPress={() => {
                          addTag(listing, customValue);
                          setCustomInputById((current) => ({
                            ...current,
                            [listing.id]: "",
                          }));
                        }}
                      >
                        Add
                      </Button>
                    </Flex>

                    <Flex align="center" gap="md">
                      <Button
                        isDisabled={!isDirty || isSaving}
                        variant="primary"
                        onPress={() => {
                          void saveListing(listing);
                        }}
                      >
                        {isSaving ? "Saving…" : "Save tags"}
                      </Button>
                      <Text size="sm" style={styles.saveStatus}>
                        {lastSavedId === listing.id ? "Saved." : ""}
                      </Text>
                    </Flex>
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
