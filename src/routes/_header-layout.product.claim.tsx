import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { z } from "zod";

import { AutocompleteInput } from "../design-system/autocomplete";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Card, CardBody, CardImage } from "../design-system/card";
import { Flex } from "../design-system/flex";
import { ListBoxItem } from "../design-system/listbox";
import { Page } from "../design-system/page";
import { TextArea } from "../design-system/text-area";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { shadow } from "../design-system/theme/shadow.stylex";
import { Heading1, Heading3 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  directoryListingApi,
  type DirectoryListingCard,
  type DirectoryListingDetail,
} from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { buildRouteOgMeta } from "../lib/og-meta";
import { SKIP_PRODUCT_CLAIM_COOKIE } from "../lib/product-claim-eligibility";

const searchSchema = z.object({
  listing: z.string().uuid().optional(),
});

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["4xl"],
    width: "100%",
  },
  section: {
    paddingLeft: horizontalSpace.xl,
    paddingRight: horizontalSpace.xl,
    paddingTop: verticalSpace["5xl"],
    paddingBottom: verticalSpace["5xl"],
  },
  card: {
    boxShadow: shadow.sm,
    maxWidth: "36rem",
    width: "100%",
  },
  wideCard: {
    boxShadow: shadow.sm,
    maxWidth: "42rem",
    width: "100%",
    overflow: "visible",
  },
  preview: {
    gap: gap.xl,
  },
  previewIcon: {
    borderRadius: "12px",
    flexShrink: 0,
    height: "64px",
    objectFit: "cover",
    width: "64px",
  },
  description: {
    maxWidth: "40rem",
    textAlign: "center",
  },
  eligibleStack: {
    marginTop: verticalSpace["3xl"],
  },
});

export const Route = createFileRoute("/_header-layout/product/claim")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ listing: search.listing }),
  loader: async ({ context, deps }) => {
    const listingId = deps.listing;
    const eligibility = await context.queryClient.ensureQueryData(
      directoryListingApi.getProductClaimEligibilityQueryOptions(),
    );
    await context.queryClient.ensureQueryData(
      directoryListingApi.getUserProductListingClaimRequestsQueryOptions(),
    );

    const focusListing = listingId
      ? await context.queryClient.ensureQueryData(
          directoryListingApi.getDirectoryListingDetailQueryOptions(listingId),
        )
      : null;

    const previewListing = focusListing ?? eligibility?.listings?.[0];

    return {
      ogTitle: "Claim your listing | at-store",
      ogDescription:
        "Move your store listing to your PDS and unlock full editing control.",
      ogImage: previewListing?.heroImageUrl || null,
    };
  },
  head: ({ loaderData }) =>
    buildRouteOgMeta({
      title: loaderData?.ogTitle ?? "Claim listing | at-store",
      description:
        loaderData?.ogDescription ||
        "Move your store listing to your PDS and unlock full editing control.",
      image: loaderData?.ogImage,
    }),
  component: ProductClaimPage,
});

function ProductClaimPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { listing: focusListingId } = Route.useSearch();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: userProfile } = useQuery({
    ...user.getUserProfileQueryOptions,
    enabled: session?.user != null,
  });
  const { data: eligibility } = useSuspenseQuery(
    directoryListingApi.getProductClaimEligibilityQueryOptions(),
  );
  const { data: claimRequests = [] } = useSuspenseQuery(
    directoryListingApi.getUserProductListingClaimRequestsQueryOptions(),
  );
  const { data: focusListing = null } = useQuery({
    ...directoryListingApi.getDirectoryListingDetailQueryOptions(
      focusListingId ?? "",
    ),
    enabled: focusListingId != null,
  });

  const displayHandle =
    userProfile?.blueskyHandle?.replace(/^@+/, "").trim() || null;
  const displayActor =
    displayHandle != null && displayHandle !== ""
      ? `@${displayHandle}`
      : (session?.user?.did ?? "your account");

  const [listingQuery, setListingQuery] = useState("");
  const [selectedListing, setSelectedListing] =
    useState<DirectoryListingCard | null>(null);
  const [proofMessage, setProofMessage] = useState("");
  const deferredSearch = useDeferredValue(listingQuery.trim());
  const canSearch = listingQuery.trim().length >= 2;

  const { data: listingSuggestions = [] } = useQuery({
    ...directoryListingApi.getListDirectoryListingsQueryOptions({
      query:
        canSearch && deferredSearch.length >= 2 ? deferredSearch : undefined,
      limit: 12,
      withoutProductAccountHandleOnly: true,
      excludeOwnedListingsForSession: true,
    }),
    enabled: canSearch && deferredSearch.length >= 2,
  });

  const claimMutation = useMutation({
    mutationFn: async (input: { listingId: string }) => {
      return directoryListingApi.claimProductListingToPds({
        data: input,
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["storeListings"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["userProfileReviews"],
      });
      void navigate({
        to: "/products/$productId",
        params: { productId: result.slug },
      });
    },
  });

  const submitManualClaimMutation = useMutation({
    mutationFn: async (input: { listingId: string; message: string }) => {
      return directoryListingApi.submitProductListingClaim({ data: input });
    },
    onSuccess: async () => {
      setProofMessage("");
      setSelectedListing(null);
      setListingQuery("");
      await queryClient.invalidateQueries({
        queryKey: ["storeListings", "userProductListingClaims"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
  });

  function dismissClaimPrompt() {
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${SKIP_PRODUCT_CLAIM_COOKIE}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    void navigate({ to: "/" });
  }

  if (claimMutation.isSuccess) {
    return (
      <Page.Root variant="small" style={styles.page}>
        <Flex direction="column" style={styles.section}>
          <Heading1>Claiming your listing</Heading1>
          <Text size="base" variant="secondary">
            Your listing has been claimed successfully.
          </Text>
        </Flex>
      </Page.Root>
    );
  }

  const hasEligible = eligibility.listings.length > 0;
  const focusListingMatchesSession = Boolean(
    focusListing?.productAccountDid &&
    session?.user?.did &&
    focusListing.productAccountDid === session.user.did,
  );
  const showFocusListingCta =
    focusListing != null && !focusListingMatchesSession;

  let content: React.ReactNode = null;

  if (showFocusListingCta) {
    content = (
      <FocusListingClaimCta
        listing={focusListing}
        currentActor={displayActor}
      />
    );
  } else if (hasEligible) {
    content = (
      <Flex direction="column" gap="4xl" style={styles.eligibleStack}>
        <Text size="base">
          We found listing(s) whose official product account matches you. Accept
          to publish the record to your PDS.
        </Text>
        {eligibility.listings.map((listing) => (
          <Flex key={listing.id} direction="column" align="center" gap="xl">
            <Card style={styles.card} size="lg">
              {listing.heroImageUrl && (
                <CardImage
                  aspectRatio={16 / 9}
                  src={listing.heroImageUrl}
                  alt=""
                />
              )}
              <CardBody>
                <Flex direction="column" style={styles.preview}>
                  <Flex gap="2xl" align="center">
                    {listing.iconUrl ? (
                      <img
                        src={listing.iconUrl}
                        alt=""
                        {...stylex.props(styles.previewIcon)}
                      />
                    ) : null}
                    <Flex direction="column" gap="2xl">
                      <Text size="2xl" weight="bold">
                        {listing.name}
                      </Text>
                      {listing.tagline ? (
                        <Text size="base" variant="secondary">
                          {listing.tagline}
                        </Text>
                      ) : null}
                    </Flex>
                  </Flex>
                  {claimMutation.isError ? (
                    <Text size="sm" variant="critical">
                      {claimMutation.error instanceof Error
                        ? claimMutation.error.message
                        : "Something went wrong."}
                    </Text>
                  ) : null}
                </Flex>
              </CardBody>
            </Card>
            <Flex gap="md" wrap>
              <Button
                variant="secondary"
                isDisabled={claimMutation.isPending}
                onPress={dismissClaimPrompt}
                size="lg"
              >
                Not now
              </Button>
              <Button
                variant="primary"
                isPending={claimMutation.isPending}
                onPress={() => {
                  claimMutation.mutate({ listingId: listing.id });
                }}
                size="lg"
              >
                Accept
              </Button>
            </Flex>
          </Flex>
        ))}
      </Flex>
    );
  } else {
    content = (
      <>
        <Text
          size="lg"
          leading="base"
          variant="secondary"
          style={styles.description}
        >
          If the listing&apos;s official Bluesky account is yours, sign in with
          that handle for an instant match. Otherwise, request a manual review
          below.
        </Text>

        <Card style={styles.wideCard} size="lg">
          <CardBody>
            <Flex direction="column" gap="4xl">
              <Heading3>Request a manual claim</Heading3>
              <Text size="sm" variant="secondary">
                For listings without a handle you control, choose the product
                and explain how we can verify you represent it (links to your
                site, socials, prior posts, etc.). A moderator will review your
                request.
              </Text>

              <AutocompleteInput<DirectoryListingCard>
                label="Find your product"
                placeholder="Start typing a product name…"
                size="lg"
                inputValue={listingQuery}
                onInputChange={(v) => {
                  submitManualClaimMutation.reset();
                  setListingQuery(v);
                  setSelectedListing(null);
                }}
                items={listingSuggestions}
                onAction={(id) => {
                  const picked = listingSuggestions.find((l) => l.id === id);
                  if (picked) {
                    setSelectedListing(picked);
                    setListingQuery(picked.name);
                  }
                }}
                renderEmptyState={() =>
                  canSearch ? "No products found." : "Type at least 2 letters."
                }
              >
                {(item) => (
                  <ListBoxItem key={item.id} id={item.id} textValue={item.name}>
                    <Flex direction="column" gap="xl">
                      <Text size="base" weight="semibold">
                        {item.name}
                      </Text>
                      {item.tagline ? (
                        <Text size="sm" variant="secondary">
                          {item.tagline}
                        </Text>
                      ) : null}
                    </Flex>
                  </ListBoxItem>
                )}
              </AutocompleteInput>

              <TextArea
                label="Proof of ownership"
                description="Be specific — generic messages may be rejected."
                size="lg"
                value={proofMessage}
                onChange={(v) => {
                  submitManualClaimMutation.reset();
                  setProofMessage(v);
                }}
                placeholder="e.g. I run this project; here is our domain and my Bluesky post announcing it…"
              />

              {submitManualClaimMutation.isError ? (
                <Text size="sm" variant="critical">
                  {submitManualClaimMutation.error instanceof Error
                    ? submitManualClaimMutation.error.message
                    : "Could not submit request."}
                </Text>
              ) : null}
              {submitManualClaimMutation.isSuccess ? (
                <Text size="sm" variant="secondary">
                  Request submitted. We&apos;ll notify you when it&apos;s
                  reviewed.
                </Text>
              ) : null}

              <Button
                variant="primary"
                size="lg"
                isPending={submitManualClaimMutation.isPending}
                isDisabled={!selectedListing || proofMessage.trim().length < 20}
                onPress={() => {
                  if (!selectedListing) return;
                  submitManualClaimMutation.mutate({
                    listingId: selectedListing.id,
                    message: proofMessage.trim(),
                  });
                }}
              >
                Submit claim request
              </Button>
            </Flex>
          </CardBody>
        </Card>

        {claimRequests.length > 0 ? (
          <Flex direction="column" gap="4xl" style={styles.wideCard}>
            <Heading3>Your requests</Heading3>
            <Flex direction="column" gap="lg">
              {claimRequests.map((req) => (
                <Card key={req.id} size="md">
                  <CardBody>
                    <Flex
                      direction="row"
                      align="center"
                      justify="between"
                      gap="xl"
                      wrap
                    >
                      <Flex direction="column" gap="2xl">
                        <Text size="lg" weight="semibold">
                          {req.listingName}
                        </Text>
                        <Text size="sm" variant="secondary">
                          Submitted{" "}
                          {new Date(req.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Text>
                        {req.decidedAt ? (
                          <Text size="sm" variant="secondary">
                            Updated{" "}
                            {new Date(req.decidedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </Text>
                        ) : null}
                      </Flex>
                      <Flex direction="column" gap="md" align="end">
                        <Badge
                          size="sm"
                          variant={
                            req.status === "approved"
                              ? "success"
                              : req.status === "rejected"
                                ? "critical"
                                : "warning"
                          }
                        >
                          {req.status}
                        </Badge>
                        {req.status === "approved" ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onPress={() => {
                              void queryClient.invalidateQueries({
                                queryKey: [
                                  "storeListings",
                                  "productClaimEligibility",
                                ],
                              });
                            }}
                          >
                            Refresh eligible listings
                          </Button>
                        ) : null}
                      </Flex>
                    </Flex>
                  </CardBody>
                </Card>
              ))}
            </Flex>
          </Flex>
        ) : null}
      </>
    );
  }

  return (
    <Page.Root variant="small" style={styles.page}>
      <Flex direction="column" align="center" gap="4xl" style={styles.section}>
        <Heading1>Claim your listing</Heading1>
        {content}
      </Flex>
    </Page.Root>
  );
}

function FocusListingClaimCta({
  listing,
  currentActor,
}: {
  listing: DirectoryListingDetail;
  currentActor: string;
}) {
  const navigate = useNavigate();
  const requiredHandle =
    listing.productAccountHandle?.replace(/^@+/, "").trim() || null;
  const redirectTarget = `/product/claim`;

  const startOAuth = useMutation({
    mutationFn: async () => {
      if (requiredHandle) {
        await navigate({
          to: "/api/auth/atproto/authorize",
          search: { handle: requiredHandle, redirect: redirectTarget },
        });
        return;
      }
      await navigate({
        to: "/login",
        search: { redirect: redirectTarget },
      });
    },
  });

  return (
    <Flex direction="column" gap="4xl" style={styles.eligibleStack}>
      <Text
        size="lg"
        variant="secondary"
        leading="base"
        style={styles.description}
      >
        {requiredHandle ? (
          <>
            You&apos;re signed in as {currentActor}. To claim this listing, sign
            in with the official product handle{" "}
            <strong>@{requiredHandle}</strong>.
          </>
        ) : (
          <>
            You&apos;re signed in as {currentActor}. This listing isn&apos;t
            linked to a Bluesky handle yet — sign in with the right account or
            request a manual claim.
          </>
        )}
      </Text>
      <Flex direction="column" align="center" gap="xl">
        <Card style={styles.card} size="lg">
          {listing.heroImageUrl && (
            <CardImage aspectRatio={16 / 9} src={listing.heroImageUrl} alt="" />
          )}
          <CardBody>
            <Flex direction="column" style={styles.preview}>
              <Flex gap="xl" align="center">
                {listing.iconUrl ? (
                  <img
                    src={listing.iconUrl}
                    alt=""
                    {...stylex.props(styles.previewIcon)}
                  />
                ) : null}
                <Flex direction="column" gap="xl">
                  <Text size="2xl" weight="bold">
                    {listing.name}
                  </Text>
                  {listing.tagline ? (
                    <Text size="base" variant="secondary">
                      {listing.tagline}
                    </Text>
                  ) : null}
                </Flex>
              </Flex>
            </Flex>
          </CardBody>
        </Card>
        <Flex gap="md" wrap>
          <Button
            variant="primary"
            size="lg"
            isPending={startOAuth.isPending}
            onPress={() => startOAuth.mutate()}
          >
            {requiredHandle ? `Login as @${requiredHandle}` : "Sign in"}
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}
