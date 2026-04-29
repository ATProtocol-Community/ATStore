import * as stylex from "@stylexjs/stylex";
import {
  useIsFetching,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Link as RouterLink,
} from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Alert } from "../design-system/alert";
import { Button } from "../design-system/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardImage,
  CardTitle,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { shadow } from "../design-system/theme/shadow.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading1, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";

const ButtonLink = createLink(Button);

const SKIPPED_LS_KEY = "admin-listing-hero-review-skipped";

export const Route = createFileRoute(
  "/_header-layout/_admin-layout/admin/listing-heroes",
)({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      directoryListingApi.getAdminListingHeroReviewQueryOptions,
    );
  },
  component: AdminListingHeroesPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  section: {
    maxWidth: "80rem",
  },
  sectionCard: {
    boxShadow: shadow.sm,
  },
  toolbar: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap.lg,
  },
  listingRows: {
    display: "flex",
    flexDirection: "column",
    gap: gap.xl,
    width: "100%",
  },
  queueNav: {
    alignItems: "center",
    flexWrap: "wrap",
    gap: gap.md,
  },
  card: {
    boxShadow: shadow.sm,
    width: "100%",
  },
  cardBody: {
    gap: gap.lg,
    paddingBottom: verticalSpace.xl,
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace.xl,
  },
  previewRow: {
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: gap.md,
    width: "100%",
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  previewLabel: {
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    opacity: 0.75,
    textTransform: "uppercase",
  },
  previewBox: {
    borderRadius: "0.5rem",
    overflow: "hidden",
  },
  actions: {
    flexWrap: "wrap",
    gap: gap.md,
  },
  emptyHint: {
    paddingBottom: verticalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
  emptyPlaceholder: {
    minHeight: "7.5rem",
  },
});

function readSkippedIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = localStorage.getItem(SKIPPED_LS_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(
      parsed.filter((x): x is string => typeof x === "string" && x.length > 0),
    );
  } catch {
    return new Set();
  }
}

function writeSkippedIds(ids: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(SKIPPED_LS_KEY, JSON.stringify([...ids]));
}

function AdminListingHeroesPage() {
  const { data: rows } = useSuspenseQuery(
    directoryListingApi.getAdminListingHeroReviewQueryOptions,
  );
  const queryClient = useQueryClient();
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const [showSkipped, setShowSkipped] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSkippedIds(readSkippedIds());
    setHydrated(true);
  }, []);

  const visibleRows = useMemo(() => {
    if (showSkipped) {
      return rows;
    }
    return rows.filter((r) => !skippedIds.has(r.id));
  }, [rows, skippedIds, showSkipped]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const visibleRowsRef = useRef(visibleRows);
  visibleRowsRef.current = visibleRows;

  useLayoutEffect(() => {
    if (visibleRows.length === 0) {
      setActiveId(null);
      return;
    }
    setActiveId((current) => {
      if (current !== null && visibleRows.some((r) => r.id === current)) {
        return current;
      }
      return visibleRows[0].id;
    });
  }, [visibleRows]);

  const goPrev = useCallback(() => {
    setActiveId((current) => {
      if (current === null) {
        return current;
      }
      const list = visibleRowsRef.current;
      const idx = list.findIndex((r) => r.id === current);
      if (idx <= 0) {
        return current;
      }
      return list[idx - 1].id;
    });
  }, []);

  const goNext = useCallback(() => {
    setActiveId((current) => {
      if (current === null) {
        return current;
      }
      const list = visibleRowsRef.current;
      const idx = list.findIndex((r) => r.id === current);
      if (idx < 0 || idx >= list.length - 1) {
        return current;
      }
      return list[idx + 1].id;
    });
  }, []);

  const skipListing = useCallback(
    (id: string) => {
      const list = visibleRowsRef.current;
      const idx = list.findIndex((r) => r.id === id);
      const nextId = list[idx + 1]?.id ?? list[idx - 1]?.id ?? null;

      setSkippedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        writeSkippedIds(next);
        return next;
      });

      if (showSkipped) {
        setActiveId(nextId ?? id);
      } else if (nextId !== null) {
        setActiveId(nextId);
      }
    },
    [showSkipped],
  );

  const unskipListing = useCallback((id: string) => {
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      writeSkippedIds(next);
      return next;
    });
  }, []);

  const clearAllSkipped = useCallback(() => {
    setSkippedIds(new Set());
    writeSkippedIds(new Set());
  }, []);

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      directoryListingApi.removeStoreManagedListingHero({ data: { id } }),
    onSuccess: async (_data, id) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getAdminListingHeroReviewQueryOptions.queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: ["storeListings"] }),
      ]);
      skipListing(id);
    },
  });

  const applyOgHeroMutation = useMutation({
    mutationFn: (id: string) =>
      directoryListingApi.applyListingHeroFromExternalOg({ data: { id } }),
    onSuccess: async (_data, id) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            directoryListingApi.getAdminListingHeroReviewQueryOptions.queryKey,
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: ["storeListings"] }),
        queryClient.refetchQueries({
          queryKey: ["storeListings", "adminExternalOg", id],
        }),
      ]);
      skipListing(id);
    },
  });

  const row =
    activeId === null
      ? null
      : (visibleRows.find((r) => r.id === activeId) ?? null);

  const activePosition =
    row === null ? -1 : visibleRows.findIndex((r) => r.id === row.id);

  const skippedCount = skippedIds.size;

  const isCurrentSkipped = row !== null && skippedIds.has(row.id);
  const pendingRemoveHero = removeMutation.isPending;
  const pendingApplyOgHero = applyOgHeroMutation.isPending;
  const heroActionsBusy = pendingRemoveHero || pendingApplyOgHero;

  const rescrapeOgBusy =
    useIsFetching({
      queryKey: ["storeListings", "adminExternalOg", activeId ?? ""],
    }) > 0;

  return (
    <Page.Root variant="large" style={styles.page}>
      <Flex direction="column" gap="6xl" style={styles.section}>
        <Flex direction="column" gap="2xl">
          <Heading1>Listing hero review</Heading1>
          <SmallBody>
            One listing at a time — use Previous / Next or finish with Skip
            (local hide). For store-published listings: remove an existing hero,
            rescrape the product URL for <code>og:image</code>, or set the
            listing hero from that image. Compare the directory hero (when
            present) to the product site&rsquo;s <code>og:image</code>.
          </SmallBody>
          <Flex style={styles.toolbar}>
            <Text size="sm" variant="secondary">
              {visibleRows.length} listing{visibleRows.length === 1 ? "" : "s"}{" "}
              in this view &middot; {rows.length} total
            </Text>
            {skippedCount > 0 ? (
              <Text size="sm" variant="secondary">
                {skippedCount} skipped in this browser
              </Text>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setShowSkipped((v) => !v)}
            >
              {showSkipped ? "Hide skipped" : "Show skipped"}
            </Button>
            {skippedCount > 0 ? (
              <Button variant="tertiary" size="sm" onPress={clearAllSkipped}>
                Clear skipped
              </Button>
            ) : null}
          </Flex>
        </Flex>

        {hydrated && visibleRows.length === 0 ? (
          <Card style={styles.sectionCard}>
            <CardBody>
              <Body style={styles.emptyHint}>
                {rows.length === 0
                  ? "No verified listings."
                  : showSkipped
                    ? "No listings match the current filters."
                    : "Every listing is hidden (skipped). Show skipped or clear skipped."}
              </Body>
            </CardBody>
          </Card>
        ) : row ? (
          <div {...stylex.props(styles.listingRows)}>
            <Flex style={styles.queueNav}>
              <Button
                variant="secondary"
                size="sm"
                onPress={goPrev}
                isDisabled={activePosition <= 0}
              >
                Previous
              </Button>
              <Text size="sm" variant="secondary">
                {activePosition + 1} of {visibleRows.length}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onPress={goNext}
                isDisabled={
                  activePosition < 0 || activePosition >= visibleRows.length - 1
                }
              >
                Next
              </Button>
            </Flex>
            {removeMutation.isError ? (
              <Alert
                variant="critical"
                title="Could not remove hero"
                onDismiss={() => removeMutation.reset()}
              >
                {removeMutation.error instanceof Error
                  ? removeMutation.error.message
                  : String(removeMutation.error)}
              </Alert>
            ) : null}
            {applyOgHeroMutation.isError ? (
              <Alert
                variant="critical"
                title="Could not set hero from site OG"
                onDismiss={() => applyOgHeroMutation.reset()}
              >
                {applyOgHeroMutation.error instanceof Error
                  ? applyOgHeroMutation.error.message
                  : String(applyOgHeroMutation.error)}
              </Alert>
            ) : null}
            <Card key={row.id} style={styles.card}>
              <CardHeader>
                <Flex direction="column" gap="md">
                  <RouterLink
                    to="/products/$productId"
                    params={{ productId: row.productSlug }}
                  >
                    <CardTitle>{row.name}</CardTitle>
                  </RouterLink>
                  <Text size="sm" variant="secondary">
                    {row.productSlug}
                    {isCurrentSkipped ? " · skipped" : ""}
                  </Text>
                </Flex>
              </CardHeader>
              <Flex direction="column" style={styles.cardBody}>
                <div {...stylex.props(styles.previewRow)}>
                  {row.heroImageUrl ? (
                    <Flex
                      direction="column"
                      gap="xs"
                      style={styles.previewColumn}
                    >
                      <span {...stylex.props(styles.previewLabel)}>
                        Listing hero
                      </span>
                      <div {...stylex.props(styles.previewBox)}>
                        <CardImage
                          aspectRatio={16 / 9}
                          src={row.heroImageUrl}
                          alt=""
                        />
                      </div>
                    </Flex>
                  ) : null}
                  <Flex
                    direction="column"
                    gap="xs"
                    style={styles.previewColumn}
                  >
                    <span {...stylex.props(styles.previewLabel)}>
                      External site OG
                    </span>
                    {row.externalPageUrl ? (
                      <Link
                        href={row.externalPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Text size="xs">Open product URL</Text>
                      </Link>
                    ) : null}
                    <ExternalSiteOgPreview
                      listingId={row.id}
                      pageUrl={row.externalPageUrl}
                    />
                  </Flex>
                </div>
                <Flex style={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => skipListing(row.id)}
                  >
                    Skip
                  </Button>
                  {isCurrentSkipped ? (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onPress={() => unskipListing(row.id)}
                    >
                      Unskip
                    </Button>
                  ) : null}
                  {row.canRemoveHero ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      isDisabled={heroActionsBusy}
                      onPress={() => {
                        if (
                          typeof window !== "undefined" &&
                          !window.confirm(
                            `Remove the hero image from “${row.name}”? The product page will drop the hero until a new one is set (OG will use the /og card).`,
                          )
                        ) {
                          return;
                        }
                        removeMutation.mutate(row.id);
                      }}
                    >
                      Remove hero
                    </Button>
                  ) : row.isStorePublished ? null : (
                    <Text size="sm" variant="secondary">
                      Hero removal only applies to listings published from the
                      store account.
                    </Text>
                  )}
                  {row.isStorePublished && row.externalPageUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      isDisabled={heroActionsBusy}
                      onPress={() => {
                        if (
                          typeof window !== "undefined" &&
                          !window.confirm(
                            `Set “${row.name}” listing hero from the product page’s og:image? This updates the store record and replaces any existing hero.`,
                          )
                        ) {
                          return;
                        }
                        applyOgHeroMutation.mutate(row.id);
                      }}
                    >
                      Use site OG as hero
                    </Button>
                  ) : null}
                  {row.externalPageUrl ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      isDisabled={rescrapeOgBusy || heroActionsBusy}
                      onPress={() => {
                        void queryClient.refetchQueries({
                          queryKey: [
                            "storeListings",
                            "adminExternalOg",
                            row.id,
                          ],
                        });
                      }}
                    >
                      Rescrape site OG
                    </Button>
                  ) : null}
                  <ButtonLink
                    to="/products/$productId"
                    params={{ productId: row.productSlug }}
                    variant="tertiary"
                    size="sm"
                  >
                    Open listing
                  </ButtonLink>
                </Flex>
              </Flex>
            </Card>
          </div>
        ) : null}
      </Flex>
    </Page.Root>
  );
}

function ExternalSiteOgPreview({
  listingId,
  pageUrl,
}: {
  listingId: string;
  pageUrl: string | null;
}) {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    ...directoryListingApi.getFetchListingExternalOgImageQueryOptions(
      listingId,
    ),
    enabled: Boolean(pageUrl),
  });

  if (!pageUrl) {
    return (
      <CardImage aspectRatio={16 / 9}>
        <Flex align="center" justify="center" style={styles.emptyPlaceholder}>
          <Text size="sm" variant="secondary">
            No product URL
          </Text>
        </Flex>
      </CardImage>
    );
  }

  if (isPending) {
    return (
      <CardImage aspectRatio={16 / 9}>
        <Flex align="center" justify="center" style={styles.emptyPlaceholder}>
          <Text size="sm" variant="secondary">
            Fetching og:image…
          </Text>
        </Flex>
      </CardImage>
    );
  }

  if (isError) {
    return (
      <Flex direction="column" gap="sm">
        <CardImage aspectRatio={16 / 9}>
          <Flex align="center" justify="center" style={styles.emptyPlaceholder}>
            <Text size="sm" variant="critical">
              {error instanceof Error ? error.message : "Request failed"}
            </Text>
          </Flex>
        </CardImage>
        <Button variant="secondary" size="sm" onPress={() => void refetch()}>
          Retry
        </Button>
      </Flex>
    );
  }

  if (!data?.ogImageUrl) {
    return (
      <Flex direction="column" gap="sm">
        <CardImage aspectRatio={16 / 9}>
          <Flex align="center" justify="center" style={styles.emptyPlaceholder}>
            <Text size="sm" variant="secondary">
              No og:image on page
            </Text>
          </Flex>
        </CardImage>
        <Button
          variant="tertiary"
          size="sm"
          isDisabled={isFetching}
          onPress={() => void refetch()}
        >
          Refresh
        </Button>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="sm">
      <div {...stylex.props(styles.previewBox)}>
        <CardImage aspectRatio={16 / 9} src={data.ogImageUrl} alt="" />
      </div>
      <Button
        variant="tertiary"
        size="sm"
        isDisabled={isFetching}
        onPress={() => void refetch()}
      >
        Refresh
      </Button>
    </Flex>
  );
}
