import * as stylex from "@stylexjs/stylex";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, createLink, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Avatar } from "../design-system/avatar";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "../design-system/alert-dialog";
import { Button } from "../design-system/button";
import { Card } from "../design-system/card";
import { ComboBox, ComboBoxItem } from "../design-system/combobox";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
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
  type DirectoryListingCategoryAssignment,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import {
  buildStructuredDirectoryCategorySlug,
  collectStructuredDirectoryCategorySuggestions,
  parseStructuredDirectoryCategory,
  primaryCategorySlug,
  type StructuredDirectoryCategoryDraft,
} from "../lib/directory-categories";

export const Route = createFileRoute("/_header-layout/dev/categories")({
  loader: async ({ context }) => {
    if (!import.meta.env.DEV) {
      throw notFound();
    }

    await context.queryClient.ensureQueryData(
      directoryListingApi.getDirectoryListingCategoryAssignmentsQueryOptions,
    );
  },
  head: () => ({
    meta: [{ title: "Recategorize listings (dev) | at-store" }],
  }),
  component: DevCategoriesPage,
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
    paddingBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["4xl"],
    paddingRight: horizontalSpace["4xl"],
    paddingTop: verticalSpace["4xl"],
  },
  listingHeader: {
    gap: gap["2xl"],
  },
  listingMeta: {
    flex: 1,
    minWidth: 0,
  },
  listingFields: {
    display: "grid",
    gap: gap["2xl"],
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  listingFooter: {
    alignItems: "end",
    flexWrap: "wrap",
  },
  selectField: {
    flex: 1,
    minWidth: "18rem",
  },
  legacyHint: {
    color: uiColor.text2,
  },
  helperText: {
    color: uiColor.text2,
    maxWidth: "48rem",
  },
  saveStatus: {
    color: uiColor.text2,
  },
  duplicateSection: {
    gap: gap["lg"],
  },
  duplicateList: {
    gap: gap["lg"],
  },
  duplicateCard: {
    borderColor: `color-mix(in srgb, ${uiColor.border1} 65%, transparent)`,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
  duplicateReasonList: {
    flexWrap: "wrap",
  },
  duplicateReason: {
    borderColor: uiColor.border1,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBottom: verticalSpace["xs"],
    paddingLeft: horizontalSpace["md"],
    paddingRight: horizontalSpace["md"],
    paddingTop: verticalSpace["xs"],
  },
});

function DevCategoriesPage() {
  const queryClient = useQueryClient();
  const { data: listings } = useSuspenseQuery(
    directoryListingApi.getDirectoryListingCategoryAssignmentsQueryOptions,
  );
  const [draftCategories, setDraftCategories] = useState<
    Record<string, StructuredDirectoryCategoryDraft>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const assigned = listings.filter(
      (listing) => listing.categorySlugs.length > 0,
    ).length;

    return {
      total: listings.length,
      assigned,
      unassigned: listings.length - assigned,
    };
  }, [listings]);
  const uncategorizedListings = useMemo(
    () => listings.filter((listing) => listing.categorySlugs.length === 0),
    [listings],
  );
  const categorySuggestions = useMemo(
    () =>
      collectStructuredDirectoryCategorySuggestions(
        listings.flatMap((listing) => listing.categorySlugs),
      ),
    [listings],
  );
  async function saveListing(listing: DirectoryListingCategoryAssignment) {
    const draft =
      draftCategories[listing.id] ??
      parseStructuredDirectoryCategory(
        primaryCategorySlug(listing.categorySlugs),
      );
    const nextCategorySlug = buildStructuredDirectoryCategorySlug(draft);

    setSavingId(listing.id);
    setLastSavedId(null);

    try {
      await directoryListingApi.updateDirectoryListingCategoryAssignment({
        data: {
          id: listing.id,
          categorySlug: nextCategorySlug,
        },
      });

      setLastSavedId(listing.id);
      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    } finally {
      setSavingId(null);
    }
  }

  async function deleteListing(listing: DirectoryListingCategoryAssignment) {
    setDeletingId(listing.id);
    setLastSavedId(null);

    try {
      await directoryListingApi.deleteDirectoryListing({
        data: {
          id: listing.id,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["storeListings"] });
    } finally {
      setDeletingId(null);
    }
  }

  function updateDraft(
    listingId: string,
    nextValues: Partial<StructuredDirectoryCategoryDraft>,
  ) {
    setDraftCategories((current) => {
      const existing =
        current[listingId] ??
        parseStructuredDirectoryCategory(
          primaryCategorySlug(
            listings.find((listing) => listing.id === listingId)
              ?.categorySlugs ?? [],
          ),
        );

      return {
        ...current,
        [listingId]: {
          ...existing,
          ...nextValues,
        },
      };
    });
  }

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" style={styles.pageContent}>
        <Flex gap="xl">
          <AppLink to={"/categories/all" as never}>Back to categories</AppLink>
          <AppLink to="/dev/app-tags">App tags</AppLink>
          <AppLink to="/home">Home</AppLink>
        </Flex>

        <Flex direction="column" style={styles.pageHeader}>
          <Heading1>Recategorize Directory Listings</Heading1>
          <Body variant="secondary">
            This dev-only tool lets you move every listing into the curated
            hierarchy. Counts on the public category pages update from the saved
            `categorySlug` values here.
          </Body>
          <Body style={styles.helperText}>
            Assign a listing to the most specific branch that fits. You can
            still use parent nodes like Apps, Bluesky, or Protocol when a more
            specific child category does not exist yet.
          </Body>
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
              <SmallBody>Assigned</SmallBody>
              <Text size="3xl" weight="semibold">
                {stats.assigned}
              </Text>
            </Flex>
          </Card>
          <Card style={styles.statCard}>
            <Flex direction="column" gap="sm">
              <SmallBody>Unassigned</SmallBody>
              <Text size="3xl" weight="semibold">
                {stats.unassigned}
              </Text>
            </Flex>
          </Card>
        </Flex>

        <Flex direction="column" style={styles.listingList}>
          {uncategorizedListings.length > 0 ? (
            uncategorizedListings.map((listing, index) => {
              const draft =
                draftCategories[listing.id] ??
                parseStructuredDirectoryCategory(
                  primaryCategorySlug(listing.categorySlugs),
                );
              const nextCategorySlug =
                buildStructuredDirectoryCategorySlug(draft);
              const isSaving = savingId === listing.id;
              const isDeleting = deletingId === listing.id;
              const isDirty =
                nextCategorySlug !== primaryCategorySlug(listing.categorySlugs);
              const duplicateCandidates = getPotentialDuplicates(
                listing,
                listings,
              ).slice(0, 5);
              const selectedAppNameOption =
                categorySuggestions.appNameOptions.find(
                  (option) =>
                    option.label.toLowerCase() ===
                    draft.appName.trim().toLowerCase(),
                )?.id || null;
              const selectedProtocolCategoryOption =
                categorySuggestions.protocolCategoryOptions.find(
                  (option) =>
                    option.label.toLowerCase() ===
                    draft.protocolCategory.trim().toLowerCase(),
                )?.id || null;
              const appCategoryOptions =
                categorySuggestions.appCategoryOptionsByAppName[
                  selectedAppNameOption || ""
                ] || [];
              const selectedAppCategoryOption =
                appCategoryOptions.find(
                  (option) =>
                    option.label.toLowerCase() ===
                    draft.appCategory.trim().toLowerCase(),
                )?.id || null;

              return (
                <Card key={listing.id} style={styles.listingCard}>
                  <Flex direction="column" style={styles.listingCardBody}>
                    <Flex direction="column" gap="md">
                      <SmallBody style={styles.legacyHint}>
                        Uncategorized listing {index + 1} of{" "}
                        {uncategorizedListings.length}
                      </SmallBody>
                      <Text size="sm" style={styles.saveStatus}>
                        {stats.unassigned} remaining
                      </Text>
                      {listing.externalUrl ? (
                        <Link href={listing.externalUrl}>
                          Open external URL
                        </Link>
                      ) : (
                        <SmallBody style={styles.legacyHint}>
                          No resolved external URL yet.
                        </SmallBody>
                      )}
                    </Flex>
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
                        <Body>{listing.description}</Body>
                        <SmallBody style={styles.legacyHint}>
                          Legacy tags: {listing.legacyCategoryHint}
                        </SmallBody>
                        <SmallBody style={styles.legacyHint}>
                          Current category:{" "}
                          {listing.categoryPathLabel || "Unassigned"}
                        </SmallBody>
                      </Flex>
                    </Flex>

                    <Flex direction="column" style={styles.duplicateSection}>
                      <Text weight="semibold">Potential duplicates</Text>
                      <SmallBody style={styles.helperText}>
                        Matches are inferred from similar names, matching
                        taglines, and external URLs.
                      </SmallBody>
                      {duplicateCandidates.length > 0 ? (
                        <Flex direction="column" style={styles.duplicateList}>
                          {duplicateCandidates.map((candidate) => (
                            <div
                              key={candidate.listing.id}
                              {...stylex.props(styles.duplicateCard)}
                            >
                              <Flex direction="column" gap="sm">
                                <Text weight="semibold">
                                  {candidate.listing.name}
                                </Text>
                                <SmallBody style={styles.legacyHint}>
                                  Current category:{" "}
                                  {candidate.listing.categoryPathLabel ||
                                    "Unassigned"}
                                </SmallBody>
                                <SmallBody style={styles.legacyHint}>
                                  {candidate.listing.tagline}
                                </SmallBody>
                                <Flex
                                  gap="sm"
                                  style={styles.duplicateReasonList}
                                >
                                  {candidate.reasons.map((reason) => (
                                    <div
                                      key={`${candidate.listing.id}-${reason}`}
                                      {...stylex.props(styles.duplicateReason)}
                                    >
                                      <SmallBody>{reason}</SmallBody>
                                    </div>
                                  ))}
                                </Flex>
                                {candidate.listing.externalUrl ? (
                                  <Link href={candidate.listing.externalUrl}>
                                    Open candidate URL
                                  </Link>
                                ) : null}
                              </Flex>
                            </div>
                          ))}
                        </Flex>
                      ) : (
                        <SmallBody style={styles.legacyHint}>
                          No likely duplicates found for this listing.
                        </SmallBody>
                      )}
                    </Flex>

                    <div {...stylex.props(styles.listingFields)}>
                      <ComboBox
                        allowsCustomValue
                        aria-label={`Kind for ${listing.name}`}
                        inputValue={draft.kind}
                        items={categorySuggestions.kindOptions}
                        label="Kind"
                        placeholder="apps or protocol"
                        selectedKey={
                          draft.kind === "apps" || draft.kind === "protocol"
                            ? draft.kind
                            : null
                        }
                        style={styles.selectField}
                        onInputChange={(value) => {
                          updateDraft(listing.id, {
                            kind: value,
                            appName:
                              value.trim().toLowerCase() === "apps"
                                ? draft.appName
                                : "",
                            appCategory:
                              value.trim().toLowerCase() === "apps"
                                ? draft.appCategory
                                : "",
                            protocolCategory:
                              value.trim().toLowerCase() === "protocol"
                                ? draft.protocolCategory
                                : "",
                          });
                        }}
                        onSelectionChange={(key) => {
                          if (key === null) {
                            return;
                          }

                          const nextKind = String(key);
                          updateDraft(listing.id, {
                            kind: nextKind,
                            appName: nextKind === "apps" ? draft.appName : "",
                            appCategory:
                              nextKind === "apps" ? draft.appCategory : "",
                            protocolCategory:
                              nextKind === "protocol"
                                ? draft.protocolCategory
                                : "",
                          });
                        }}
                      >
                        {(item) => (
                          <ComboBoxItem id={item.id}>{item.label}</ComboBoxItem>
                        )}
                      </ComboBox>

                      {draft.kind.trim().toLowerCase() === "apps" ? (
                        <>
                          <ComboBox
                            allowsCustomValue
                            aria-label={`App name for ${listing.name}`}
                            inputValue={draft.appName}
                            items={categorySuggestions.appNameOptions}
                            label="App Name"
                            placeholder="Bluesky"
                            selectedKey={selectedAppNameOption}
                            style={styles.selectField}
                            onInputChange={(value) => {
                              updateDraft(listing.id, {
                                appName: value,
                                appCategory: "",
                              });
                            }}
                            onSelectionChange={(key) => {
                              const nextAppNameId = key ? String(key) : "";
                              const nextAppNameLabel =
                                categorySuggestions.appNameOptions.find(
                                  (option) => option.id === nextAppNameId,
                                )?.label || nextAppNameId;

                              updateDraft(listing.id, {
                                appName: nextAppNameLabel,
                                appCategory: "",
                              });
                            }}
                          >
                            {(item) => (
                              <ComboBoxItem id={item.id}>
                                {item.label}
                              </ComboBoxItem>
                            )}
                          </ComboBox>

                          <ComboBox
                            allowsCustomValue
                            aria-label={`App category for ${listing.name}`}
                            inputValue={draft.appCategory}
                            items={appCategoryOptions}
                            label="App Name Category"
                            placeholder="Clients"
                            selectedKey={selectedAppCategoryOption}
                            style={styles.selectField}
                            onInputChange={(value) => {
                              updateDraft(listing.id, {
                                appCategory: value,
                              });
                            }}
                            onSelectionChange={(key) => {
                              const nextAppCategoryId = key ? String(key) : "";
                              const nextAppCategoryLabel =
                                appCategoryOptions.find(
                                  (option) => option.id === nextAppCategoryId,
                                )?.label || nextAppCategoryId;

                              updateDraft(listing.id, {
                                appCategory: nextAppCategoryLabel,
                              });
                            }}
                          >
                            {(item) => (
                              <ComboBoxItem id={item.id}>
                                {item.label}
                              </ComboBoxItem>
                            )}
                          </ComboBox>
                        </>
                      ) : null}

                      {draft.kind.trim().toLowerCase() === "protocol" ? (
                        <ComboBox
                          allowsCustomValue
                          aria-label={`Protocol category for ${listing.name}`}
                          inputValue={draft.protocolCategory}
                          items={categorySuggestions.protocolCategoryOptions}
                          label="Protocol Category"
                          placeholder="PDS"
                          selectedKey={selectedProtocolCategoryOption}
                          style={styles.selectField}
                          onInputChange={(value) => {
                            updateDraft(listing.id, {
                              protocolCategory: value,
                            });
                          }}
                          onSelectionChange={(key) => {
                            const nextProtocolCategoryId = key
                              ? String(key)
                              : "";
                            const nextProtocolCategoryLabel =
                              categorySuggestions.protocolCategoryOptions.find(
                                (option) =>
                                  option.id === nextProtocolCategoryId,
                              )?.label || nextProtocolCategoryId;

                            updateDraft(listing.id, {
                              protocolCategory: nextProtocolCategoryLabel,
                            });
                          }}
                        >
                          {(item) => (
                            <ComboBoxItem id={item.id}>
                              {item.label}
                            </ComboBoxItem>
                          )}
                        </ComboBox>
                      ) : null}
                    </div>

                    <Flex gap="lg" style={styles.listingFooter}>
                      <Button
                        isDisabled={
                          !isDirty ||
                          isSaving ||
                          isDeleting ||
                          nextCategorySlug === null
                        }
                        onPress={() => void saveListing(listing)}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <AlertDialog
                        trigger={
                          <Button
                            variant="secondary"
                            isDisabled={isSaving || isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </Button>
                        }
                      >
                        <AlertDialogHeader>
                          Delete this listing?
                        </AlertDialogHeader>
                        <AlertDialogDescription>
                          This will permanently remove{" "}
                          <strong>{listing.name}</strong> from the directory.
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancelButton />
                          <AlertDialogActionButton
                            isPending={isDeleting}
                            closeOnPress={false}
                            onPress={() => void deleteListing(listing)}
                          >
                            Delete entry
                          </AlertDialogActionButton>
                        </AlertDialogFooter>
                      </AlertDialog>
                      <SmallBody style={styles.saveStatus}>
                        {lastSavedId === listing.id ? "Saved." : " "}
                      </SmallBody>
                    </Flex>
                  </Flex>
                </Card>
              );
            })
          ) : (
            <Card style={styles.listingCard}>
              <Flex direction="column" style={styles.listingCardBody}>
                <Heading1>All caught up</Heading1>
                <Body variant="secondary">
                  There are no uncategorized listings left right now.
                </Body>
              </Flex>
            </Card>
          )}
        </Flex>
      </Flex>
    </Page.Root>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

type PotentialDuplicateCandidate = {
  listing: DirectoryListingCategoryAssignment;
  reasons: string[];
  score: number;
};

function getPotentialDuplicates(
  listing: DirectoryListingCategoryAssignment,
  listings: DirectoryListingCategoryAssignment[],
) {
  const normalizedName = normalizeDuplicateText(listing.name);
  const normalizedTagline = normalizeDuplicateText(listing.tagline);
  const normalizedExternalUrl = normalizeDuplicateUrl(listing.externalUrl);
  const externalHost = getDuplicateUrlHost(listing.externalUrl);

  return listings
    .flatMap((candidate) => {
      if (candidate.id === listing.id) {
        return [];
      }

      const candidateName = normalizeDuplicateText(candidate.name);
      const candidateTagline = normalizeDuplicateText(candidate.tagline);
      const candidateExternalUrl = normalizeDuplicateUrl(candidate.externalUrl);
      const candidateExternalHost = getDuplicateUrlHost(candidate.externalUrl);
      const reasons: string[] = [];
      let score = 0;

      if (
        normalizedExternalUrl &&
        candidateExternalUrl === normalizedExternalUrl
      ) {
        reasons.push("Same external URL");
        score += 6;
      }

      if (normalizedName.length >= 3 && candidateName === normalizedName) {
        reasons.push("Same name");
        score += 4;
      } else if (
        normalizedName.length >= 6 &&
        candidateName.length >= 6 &&
        (candidateName.includes(normalizedName) ||
          normalizedName.includes(candidateName))
      ) {
        reasons.push("Similar name");
        score += 2;
      }

      if (
        normalizedTagline.length >= 12 &&
        candidateTagline === normalizedTagline
      ) {
        reasons.push("Same tagline");
        score += 2;
      }

      if (externalHost && candidateExternalHost === externalHost) {
        reasons.push(`Same host (${externalHost})`);
        score += 1;
      }

      if (score < 3) {
        return [];
      }

      return [
        {
          listing: candidate,
          reasons,
          score,
        } satisfies PotentialDuplicateCandidate,
      ];
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.listing.name.localeCompare(right.listing.name);
    });
}

function normalizeDuplicateText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeDuplicateUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function getDuplicateUrlHost(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
