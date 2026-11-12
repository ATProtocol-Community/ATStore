import * as stylex from "@stylexjs/stylex";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { Search, UserRound } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { z } from "zod";

import type {
  DirectoryListingCard,
  DirectoryListingDetail,
} from "../integrations/tanstack-query/api-directory-listings.functions";

import { Eyebrow, FormCard } from "../components/shelf/info/InfoBlocks";
import { ListingIcon } from "../components/shelf/ListingIcon";
import { PageHero, SectionHeader } from "../components/shelf/Section";
import { AutocompleteInput } from "../design-system/autocomplete";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { ListBoxItem } from "../design-system/listbox";
import { TextArea } from "../design-system/text-area";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { criticalColor, uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { buildRouteOgMeta } from "../lib/og-meta";
import { SKIP_PRODUCT_CLAIM_COOKIE } from "../lib/product-claim-eligibility";

const searchSchema = z.object({
  listing: z.string().uuid().optional(),
});

const styles = stylex.create({
  page: {
    marginInline: "auto",
    boxSizing: "border-box",
    fontFamily: fontFamily.sans,
    maxWidth: 820,
    width: "100%",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
  },
  claimCard: {
    padding: { default: 20, [breakpoints.md]: 24 },
    borderColor: uiColor.border2,
    borderRadius: 20,
    borderStyle: "solid",
    borderWidth: 1,
    backgroundColor: uiColor.bg,
  },
  listingRow: {
    marginBlock: 14,
    alignItems: "center",
    columnGap: 14,
    display: "flex",
    minWidth: 0,
  },
  listingName: {
    color: uiColor.text2,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    letterSpacing: "-0.006em",
  },
  listingTagline: {
    color: uiColor.text1,
    lineHeight: 1.4,
  },
  bodyText: {
    color: uiColor.text1,
    lineHeight: 1.55,
    marginBottom: 18,
    marginTop: 0,
  },
  strong: {
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  actions: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 10,
  },
  formIntro: {
    color: uiColor.text1,
    lineHeight: 1.55,
    marginBottom: 22,
    marginTop: -6,
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    rowGap: 22,
  },
  formFoot: {
    alignItems: "center",
    columnGap: 16,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    rowGap: 10,
    marginTop: 22,
  },
  status: {
    fontSize: 14,
    lineHeight: 1.45,
    marginRight: "auto",
  },
  statusOk: {
    color: uiColor.text1,
  },
  statusError: {
    color: criticalColor.text1,
  },
  suggestion: {
    display: "flex",
    flexDirection: "column",
    rowGap: 2,
    minWidth: 0,
  },
  suggestionName: {
    fontWeight: fontWeight.semibold,
  },
  suggestionTagline: {
    color: uiColor.text1,
    fontSize: 13,
  },
  requests: {
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    marginTop: { default: 36, [breakpoints.md]: 52 },
    paddingTop: { default: 36, [breakpoints.md]: 52 },
  },
  requestList: {
    margin: 0,
    padding: 0,
    borderColor: uiColor.border1,
    borderRadius: 18,
    borderStyle: "solid",
    borderWidth: 1,
    listStyle: "none",
    overflow: "hidden",
    backgroundColor: uiColor.bg,
  },
  requestRow: {
    paddingBlock: 14,
    paddingInline: { default: 16, [breakpoints.md]: 20 },
    alignItems: "center",
    columnGap: 14,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 10,
    borderTopColor: uiColor.border1,
    borderTopStyle: {
      default: "solid",
      ":first-child": "none",
    },
    borderTopWidth: 1,
  },
  requestMain: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 180,
  },
  requestName: {
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
    textDecorationColor: uiColor.border2,
    textUnderlineOffset: 3,
    transitionDuration: animationDuration.default,
  },
  requestMeta: {
    color: uiColor.text1,
    fontSize: 13,
    marginTop: 2,
  },
  requestSide: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    rowGap: 10,
  },
  empty: {
    padding: 28,
    borderColor: uiColor.border2,
    borderRadius: 18,
    borderStyle: "dashed",
    borderWidth: 1,
    color: uiColor.text1,
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
    // Cookie Store API is async and not yet universal for simple dismiss flags.
    // eslint-disable-next-line unicorn/no-document-cookie -- synchronous dismiss flag for client-only flow
    document.cookie = `${SKIP_PRODUCT_CLAIM_COOKIE}=1; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    void navigate({ to: "/" });
  }

  if (claimMutation.isSuccess) {
    return (
      <div {...stylex.props(styles.page)}>
        <PageHero
          title="Claiming your listing"
          description="Your listing has been claimed successfully."
        />
      </div>
    );
  }

  const hasEligible = eligibility.listings.length > 0;
  const focusListingMatchesSession = Boolean(
    focusListing?.productAccountDid &&
    session?.user?.did &&
    focusListing.productAccountDid === session.user.did,
  );
  const focusListingIsEligible = Boolean(
    focusListing &&
    eligibility.listings.some((listing) => listing.id === focusListing.id),
  );
  const showFocusListingCta =
    focusListing != null &&
    !focusListingMatchesSession &&
    !focusListingIsEligible;

  let description: React.ReactNode = null;
  let content: React.ReactNode = null;

  if (showFocusListingCta) {
    content = (
      <FocusListingClaimCta
        listing={focusListing}
        currentActor={displayActor}
      />
    );
  } else if (hasEligible) {
    description = eligibility.listings.every(
      (listing) => listing.kind === "transfer",
    )
      ? "These listings were offered to you by their current owner. Accept to move the record to your PDS."
      : "We found listing(s) that belong to this account. Accept to publish the record to your PDS.";
    content = (
      <div {...stylex.props(styles.stack)}>
        {eligibility.listings.map((listing) => (
          <article key={listing.id} {...stylex.props(styles.claimCard)}>
            <Eyebrow>
              {listing.kind === "transfer" ? "Transfer offer" : "Instant match"}
            </Eyebrow>
            <ListingSummary
              name={listing.name}
              tagline={listing.tagline}
              iconUrl={listing.iconUrl}
            />
            {claimMutation.isError ? (
              <p
                role="alert"
                {...stylex.props(styles.bodyText, styles.statusError)}
              >
                {claimMutation.error instanceof Error
                  ? claimMutation.error.message
                  : "Something went wrong."}
              </p>
            ) : null}
            <div {...stylex.props(styles.actions)}>
              <Button
                variant="primary"
                isPending={claimMutation.isPending}
                onPress={() => {
                  claimMutation.mutate({ listingId: listing.id });
                }}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                isDisabled={claimMutation.isPending}
                onPress={dismissClaimPrompt}
              >
                Not now
              </Button>
            </div>
          </article>
        ))}
      </div>
    );
  } else {
    description =
      "If the listing's official Bluesky account is yours, sign in with that handle for an instant match. Otherwise, request a manual review below.";
    const proofLength = proofMessage.trim().length;
    content = (
      <>
        <FormCard title="Request a manual claim" titleId="manual-claim-title">
          <p {...stylex.props(styles.formIntro)}>
            For listings without a handle you control, choose the product and
            explain how we can verify you represent it (links to your site,
            socials, prior posts, etc.). A moderator will review your request.
          </p>

          <div {...stylex.props(styles.fields)}>
            <AutocompleteInput<DirectoryListingCard>
              label="Find your product"
              placeholder="Start typing a product name…"
              size="lg"
              prefix={<Search size={16} aria-hidden />}
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
                  <span {...stylex.props(styles.suggestion)}>
                    <span {...stylex.props(styles.suggestionName)}>
                      {item.name}
                    </span>
                    {item.tagline ? (
                      <span {...stylex.props(styles.suggestionTagline)}>
                        {item.tagline}
                      </span>
                    ) : null}
                  </span>
                </ListBoxItem>
              )}
            </AutocompleteInput>

            <TextArea
              label="Proof of ownership"
              description={`Be specific: generic messages may be rejected. At least 20 characters${
                proofLength > 0 && proofLength < 20
                  ? ` (${String(20 - proofLength)} to go)`
                  : ""
              }.`}
              size="lg"
              rows={5}
              autosize={false}
              value={proofMessage}
              onChange={(v) => {
                submitManualClaimMutation.reset();
                setProofMessage(v);
              }}
              placeholder="e.g. I run this project; here is our domain and my Bluesky post announcing it…"
            />
          </div>

          <div {...stylex.props(styles.formFoot)}>
            {submitManualClaimMutation.isError ? (
              <p
                role="alert"
                {...stylex.props(styles.status, styles.statusError)}
              >
                {submitManualClaimMutation.error instanceof Error
                  ? submitManualClaimMutation.error.message
                  : "Could not submit request."}
              </p>
            ) : null}
            {submitManualClaimMutation.isSuccess ? (
              <p
                role="status"
                {...stylex.props(styles.status, styles.statusOk)}
              >
                Request submitted. We&apos;ll notify you when it&apos;s
                reviewed.
              </p>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              isPending={submitManualClaimMutation.isPending}
              isDisabled={!selectedListing || proofLength < 20}
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
          </div>
        </FormCard>

        {claimRequests.length > 0 || session?.user != null ? (
          <section
            aria-labelledby="claim-requests-title"
            {...stylex.props(styles.requests)}
          >
            <SectionHeader
              title={<span id="claim-requests-title">Your requests</span>}
            />
            {claimRequests.length > 0 ? (
              <ul {...stylex.props(styles.requestList)}>
                {claimRequests.map((req) => (
                  <li key={req.id} {...stylex.props(styles.requestRow)}>
                    <ListingIcon
                      name={req.listingName}
                      src={req.listingIconUrl}
                      size={40}
                    />
                    <div {...stylex.props(styles.requestMain)}>
                      {req.listingSlug ? (
                        <RouterLink
                          to="/products/$productId"
                          params={{ productId: req.listingSlug }}
                          {...stylex.props(styles.requestName)}
                        >
                          {req.listingName}
                        </RouterLink>
                      ) : (
                        <span {...stylex.props(styles.listingName)}>
                          {req.listingName}
                        </span>
                      )}
                      <div {...stylex.props(styles.requestMeta)}>
                        Submitted{" "}
                        {new Date(req.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {req.decidedAt ? (
                          <>
                            {" · "}Updated{" "}
                            {new Date(req.decidedAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div {...stylex.props(styles.requestSide)}>
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
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div {...stylex.props(styles.empty)}>
                You haven&apos;t requested any claims.
              </div>
            )}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <div {...stylex.props(styles.page)}>
      <PageHero title="Claim your listing" description={description} />
      {content}
    </div>
  );
}

function ListingSummary({
  name,
  tagline,
  iconUrl,
}: {
  name: string;
  tagline: string | null | undefined;
  iconUrl: string | null | undefined;
}) {
  return (
    <div {...stylex.props(styles.listingRow)}>
      <ListingIcon name={name} src={iconUrl} size={56} />
      <div>
        <div {...stylex.props(styles.listingName)}>{name}</div>
        {tagline ? (
          <div {...stylex.props(styles.listingTagline)}>{tagline}</div>
        ) : null}
      </div>
    </div>
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
    <article {...stylex.props(styles.claimCard)}>
      <Eyebrow>{requiredHandle ? "Instant match" : "Sign in to claim"}</Eyebrow>
      <ListingSummary
        name={listing.name}
        tagline={listing.tagline}
        iconUrl={listing.iconUrl}
      />
      <p {...stylex.props(styles.bodyText)}>
        {requiredHandle ? (
          <>
            This listing&apos;s official account is{" "}
            <strong {...stylex.props(styles.strong)}>@{requiredHandle}</strong>.
            You&apos;re signed in as{" "}
            <strong {...stylex.props(styles.strong)}>{currentActor}</strong>, so
            sign in with the official product handle to claim it instantly.
          </>
        ) : (
          <>
            You&apos;re signed in as{" "}
            <strong {...stylex.props(styles.strong)}>{currentActor}</strong>.
            This listing isn&apos;t linked to a Bluesky handle yet. Sign in with
            the right account or request a manual claim.
          </>
        )}
      </p>
      <div {...stylex.props(styles.actions)}>
        <Button
          variant="primary"
          isPending={startOAuth.isPending}
          onPress={() => startOAuth.mutate()}
        >
          <UserRound size={15} aria-hidden />
          {requiredHandle ? `Log in as @${requiredHandle}` : "Sign in"}
        </Button>
      </div>
    </article>
  );
}
