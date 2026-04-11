import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";
import { Link as AriaLink } from "react-aria-components";

import { BlueskyIcon } from "#/components/bluesky-icon";
import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { Avatar } from "../design-system/avatar";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Page } from "../design-system/page";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, Heading3 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { useButtonStyles } from "#/design-system/theme/useButtonStyles";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { resolveProfilePathActorToDid } from "../lib/bluesky-public-profile";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { radius } from "../design-system/theme/radius.stylex";
import { uiColor } from "../design-system/theme/color.stylex";

const RouterLink = createLink(AriaLink);

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["4xl"],
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: gap["4xl"],
  },
  hero: {
    gap: gap["2xl"],
    marginBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
  },
  titleBlock: {
    gap: gap["xl"],
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 0,
  },
  reviews: {
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
  },
  ownedSection: {
    marginBottom: verticalSpace["4xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
  },
  ownedGrid: {
    gap: gap.lg,
    display: "grid",
    gridTemplateColumns: {
      default: "1fr",
      "@media (min-width: 640px)": "repeat(2, minmax(0, 1fr))",
    },
  },
  ownedCard: {
    alignItems: "center",
    borderColor: "var(--ds-ui-component-2, rgba(0,0,0,0.12))",
    borderRadius: radius["lg"],
    borderStyle: "solid",
    borderWidth: 1,
    color: uiColor.text2,
    cornerShape: "squircle",
    display: "flex",
    gap: gap.lg,
    minWidth: 0,
    padding: horizontalSpace.lg,
    textDecoration: "none",
    backgroundColor: {
      default: uiColor.bg,
      ":is([data-hovered])": uiColor.component2,
    },
  },
  ownedIcon: {
    borderRadius: "10px",
    flexShrink: 0,
    height: size["5xl"],
    objectFit: "cover",
    width: size["5xl"],
  },
  ownedTextColumn: {
    minWidth: 0,
  },
  noReviews: {
    paddingTop: verticalSpace["6xl"],
    paddingBottom: verticalSpace["6xl"],
    paddingLeft: horizontalSpace["xl"],
    paddingRight: horizontalSpace["xl"],
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: uiColor.border2,
    borderRadius: radius["xl"],
    cornerShape: "squircle",
  },
  iconButton: {
    height: size["4xl"],
    width: size["4xl"],
  },
});

export const Route = createFileRoute("/_header-layout/profile/$actor")({
  loader: async ({ context, params }) => {
    const resolvedDid = await resolveProfilePathActorToDid(params.actor);
    if (resolvedDid == null) {
      throw notFound();
    }
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(
        directoryListingApi.getUserProfileReviewsPageDataQueryOptions(
          resolvedDid,
        ),
      ),
      context.queryClient.ensureQueryData(
        directoryListingApi.getProfileOwnedProductListingsQueryOptions(
          resolvedDid,
        ),
      ),
    ]);
    if (data == null) {
      throw notFound();
    }
    return { did: resolvedDid };
  },
  component: UserProfilePage,
});

function UserProfilePage() {
  const navigate = useNavigate();
  const { did } = Route.useLoaderData();
  const { data: page } = useSuspenseQuery(
    directoryListingApi.getUserProfileReviewsPageDataQueryOptions(did),
  );
  const { data: ownedProducts } = useSuspenseQuery(
    directoryListingApi.getProfileOwnedProductListingsQueryOptions(did),
  );
  const { data: session } = useQuery(user.getSessionQueryOptions);

  if (page == null) {
    throw notFound();
  }

  const handleDisplay = page.handle?.trim()
    ? `@${page.handle.replace(/^@+/, "")}`
    : null;
  const mainTitle =
    page.displayName?.trim() ||
    handleDisplay ||
    (did.length > 28 ? `${did.slice(0, 18)}…` : did);
  const subtitle =
    page.displayName?.trim() && handleDisplay ? handleDisplay : null;
  const buttonStyles = useButtonStyles({ variant: "secondary", size: "lg" });
  const blueskyProfileId = page.handle?.trim()
    ? page.handle.replace(/^@+/, "")
    : did;
  const blueskyProfileUrl = `https://bsky.app/profile/${blueskyProfileId}`;

  return (
    <HeaderLayout.Page>
      <Page.Root variant="small" style={styles.page}>
        <Flex direction="column" style={styles.hero}>
          <Flex gap="2xl" align="center">
            <Avatar
              alt={mainTitle}
              fallback={mainTitle.charAt(0).toUpperCase()}
              size="xl"
              src={page.avatarUrl || undefined}
            />
            <Flex direction="column" style={styles.titleBlock}>
              <Heading3>{mainTitle}</Heading3>
              {subtitle ? (
                <Text size="sm" variant="secondary">
                  {subtitle}
                </Text>
              ) : null}
            </Flex>

            <AriaLink
              {...stylex.props(buttonStyles, styles.iconButton)}
              href={blueskyProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BlueskyIcon />
            </AriaLink>
          </Flex>
        </Flex>

        {ownedProducts && ownedProducts.length > 0 ? (
          <Flex direction="column" gap="4xl" style={styles.ownedSection}>
            <Heading3>Products</Heading3>
            <div {...stylex.props(styles.ownedGrid)}>
              {ownedProducts.map((p) => (
                <RouterLink
                  key={p.id}
                  to="/products/$productId"
                  params={{ productId: getDirectoryListingSlug(p) }}
                  {...stylex.props(styles.ownedCard)}
                >
                  {p.iconUrl ? (
                    <img
                      src={p.iconUrl}
                      alt=""
                      {...stylex.props(styles.ownedIcon)}
                    />
                  ) : null}
                  <Flex
                    direction="column"
                    gap="xl"
                    style={styles.ownedTextColumn}
                  >
                    <Flex justify="between" align="center" gap="lg">
                      <Text size="lg" weight="bold">
                        {p.name}
                      </Text>
                      <Text size="sm" variant="secondary">
                        {p.reviewCount === 0
                          ? "No reviews"
                          : `${p.reviewCount} review${p.reviewCount === 1 ? "" : "s"}`}
                        {p.averageRating != null && p.reviewCount > 0
                          ? ` · ${Number(p.averageRating).toFixed(1)} ★`
                          : ""}
                      </Text>
                    </Flex>
                    {p.tagline ? (
                      <Text size="sm" variant="secondary">
                        {p.tagline}
                      </Text>
                    ) : null}
                  </Flex>
                </RouterLink>
              ))}
            </div>
          </Flex>
        ) : null}

        <Flex direction="column" gap="4xl" style={styles.reviews}>
          <Heading3>Reviews</Heading3>
          {page.reviews.length > 0 ? (
            page.reviews.map((review) => (
              <DirectoryListingReviewCard
                key={review.id}
                listingId={review.listing.id}
                reviewedListing={review.listing}
                review={review}
                viewerDid={session?.user?.did ?? null}
                onEditReview={() => {
                  void navigate({
                    to: "/products/$productId/reviews/$reviewId/edit",
                    params: {
                      productId: getDirectoryListingSlug(review.listing),
                      reviewId: review.id,
                    },
                  });
                }}
              />
            ))
          ) : (
            <Flex
              direction="column"
              gap="2xl"
              justify="center"
              align="center"
              style={styles.noReviews}
            >
              <Body variant="secondary">No reviews yet.</Body>
            </Flex>
          )}
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
