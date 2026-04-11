import * as stylex from "@stylexjs/stylex";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  notFound,
  useNavigate,
} from "@tanstack/react-router";

import { DirectoryListingReviewCard } from "../components/DirectoryListingReviewCard";
import { Avatar } from "../design-system/avatar";
import { Flex } from "../design-system/flex";
import { HeaderLayout } from "../design-system/header-layout";
import { Page } from "../design-system/page";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Link } from "../design-system/link";
import { Heading3 } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { directoryListingApi } from "../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { resolveProfilePathActorToDid } from "../lib/bluesky-public-profile";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";

const ProfileProductLink = createLink(Link);

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    marginLeft: "auto",
    marginRight: "auto",
    paddingBottom: verticalSpace["8xl"],
    paddingTop: verticalSpace["4xl"],
    width: "100%",
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
    gap: gap.xl,
  },
  ownedSection: {
    gap: gap.xl,
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
    borderRadius: "12px",
    borderStyle: "solid",
    borderWidth: 1,
    display: "flex",
    gap: gap.lg,
    minWidth: 0,
    padding: horizontalSpace.lg,
    textDecoration: "none",
  },
  ownedIcon: {
    borderRadius: "10px",
    flexShrink: 0,
    height: "48px",
    objectFit: "cover",
    width: "48px",
  },
  ownedTextColumn: {
    minWidth: 0,
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
            <Text size="lg" variant="secondary">
              {page.reviews.length === 0
                ? "No reviews yet."
                : `${page.reviews.length} review${page.reviews.length === 1 ? "" : "s"}`}
            </Text>
          </Flex>
        </Flex>

        {ownedProducts && ownedProducts.length > 0 ? (
          <Flex direction="column" style={styles.ownedSection}>
            <Heading3>Products</Heading3>
            <div {...stylex.props(styles.ownedGrid)}>
              {ownedProducts.map((p) => (
                <ProfileProductLink
                  key={p.id}
                  to="/products/$productId"
                  params={{ productId: getDirectoryListingSlug(p) }}
                  style={styles.ownedCard}
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
                    gap="xs"
                    style={styles.ownedTextColumn}
                  >
                    <Text size="base" weight="bold">
                      {p.name}
                    </Text>
                    {p.tagline ? (
                      <Text size="sm" variant="secondary" hasEllipsis>
                        {p.tagline}
                      </Text>
                    ) : null}
                    <Text size="sm" variant="secondary">
                      {p.reviewCount === 0
                        ? "No reviews"
                        : `${p.reviewCount} review${p.reviewCount === 1 ? "" : "s"}`}
                      {p.averageRating != null && p.reviewCount > 0
                        ? ` · ${Number(p.averageRating).toFixed(1)}★`
                        : ""}
                    </Text>
                  </Flex>
                </ProfileProductLink>
              ))}
            </div>
          </Flex>
        ) : null}

        <Flex direction="column" style={styles.reviews}>
          {page.reviews.map((review) => (
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
          ))}
        </Flex>
      </Page.Root>
    </HeaderLayout.Page>
  );
}
