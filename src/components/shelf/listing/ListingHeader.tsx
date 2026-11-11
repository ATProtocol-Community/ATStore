import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, createLink } from "@tanstack/react-router";
import { ArrowUpRight, Heart, Star } from "lucide-react";
import { Fragment } from "react";
import { Link as AriaLink } from "react-aria-components";

import type { DirectoryListingDetail } from "../../../integrations/tanstack-query/api-directory-listings.functions";

import { Button } from "../../../design-system/button";
import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { fontFamily } from "../../../design-system/theme/typography.stylex";
import { useButtonStyles } from "../../../design-system/theme/useButtonStyles";
import { ToggleButton } from "../../../design-system/toggle-button";
import { directoryListingApi } from "../../../integrations/tanstack-query/api-directory-listings.functions";
import { user } from "../../../integrations/tanstack-query/api-user.functions";
import { getGamePlayLabel, getGameStatus } from "../../../lib/game-listing";
import { BlueskyIcon } from "../../bluesky-icon";
import { MIN_REVIEWS_FOR_AVERAGE, formatReviewCount } from "../format";
import { ListingIcon } from "../ListingIcon";
import { getUrlDomain } from "./listing-helpers";

const ButtonLink = createLink(Button);

const FAVORITE_PINK = "#e0245e";

const styles = stylex.create({
  root: {
    alignItems: "center",
    columnGap: { default: 16, [breakpoints.md]: 28 },
    display: "grid",
    gridTemplateColumns: {
      default: "auto minmax(0, 1fr)",
      [breakpoints.lg]: "auto minmax(0, 1fr) auto",
    },
    rowGap: { default: 16, [breakpoints.md]: 24 },
    paddingBottom: { default: 24, [breakpoints.md]: 40 },
    paddingTop: { default: 16, [breakpoints.md]: 24 },
  },
  icon: {
    borderRadius: { default: 20, [breakpoints.md]: 26 },
    fontSize: { default: 36, [breakpoints.md]: 48 },
    height: { default: 84, [breakpoints.md]: 112 },
    width: { default: 84, [breakpoints.md]: 112 },
  },
  text: {
    minWidth: 0,
  },
  name: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: { default: 36, [breakpoints.md]: 60 },
    fontWeight: 750,
    letterSpacing: "-0.052em",
    lineHeight: 1,
    overflowWrap: "anywhere",
    textWrap: "balance",
  },
  tagline: {
    color: `color-mix(in srgb, ${uiColor.text2} 78%, transparent)`,
    fontSize: { default: 17, [breakpoints.md]: 21 },
    letterSpacing: "-0.01em",
    lineHeight: 1.3,
    textWrap: "pretty",
    marginBottom: { default: 8, [breakpoints.md]: 12 },
    marginTop: { default: 6, [breakpoints.md]: 10 },
  },
  meta: {
    alignItems: "center",
    color: uiColor.text1,
    display: "flex",
    flexWrap: "wrap",
    fontSize: 14,
    rowGap: 6,
  },
  dot: {
    borderRadius: "50%",
    marginInline: 10,
    backgroundColor: "currentColor",
    display: "inline-block",
    opacity: 0.5,
    height: 3,
    width: 3,
  },
  ratingLink: {
    borderRadius: 4,
    textDecoration: "none",
    alignItems: "center",
    color: {
      default: uiColor.text2,
      ":hover": uiColor.text1,
    },
    columnGap: 4,
    display: "inline-flex",
    fontVariantNumeric: "tabular-nums",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  ratingCount: {
    color: uiColor.text1,
  },
  star: {
    fill: "currentColor",
  },
  actions: {
    gridColumn: { default: "1 / -1", [breakpoints.lg]: "auto" },
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 10,
  },
  primary: {
    flexGrow: { default: 1, [breakpoints.sm]: 0 },
  },
  iconButton: {
    paddingInline: 0,
    width: 44,
  },
  favorite: {
    borderColor: {
      default: uiColor.border2,
      ":is([data-hovered])": uiColor.text2,
      ":is([data-selected])": FAVORITE_PINK,
    },
    backgroundColor: uiColor.bg,
    color: {
      default: uiColor.text2,
      ":is([data-selected])": FAVORITE_PINK,
    },
  },
  heartFilled: {
    fill: FAVORITE_PINK,
  },
});

export function ListingHeader({
  listing,
  productId,
  productSlug,
}: {
  listing: DirectoryListingDetail;
  productId: string;
  productSlug: string;
}) {
  const isGame = listing.listingType === "game";
  const gameStatus = isGame ? getGameStatus(listing.game?.status) : null;
  const handle = listing.productAccountHandle?.trim().replace(/^@/, "");
  const reviewCount = listing.reviewCount;
  const primaryUrl = listing.externalUrl?.trim() || null;
  const domain = getUrlDomain(primaryUrl);
  const iconButtonStyles = useButtonStyles({
    variant: "secondary",
    size: "lg",
  });

  const primaryLabel =
    gameStatus === "coming" || gameStatus === "archived"
      ? getGamePlayLabel(gameStatus)
      : domain
        ? `${isGame ? "Play on" : "Open"} ${domain}`
        : isGame
          ? "Play"
          : "Explore";

  const metaItems: Array<{ key: string; node: ReactNode }> = [];
  if (handle) metaItems.push({ key: "handle", node: <span>@{handle}</span> });
  if (reviewCount > 0) {
    metaItems.push({
      key: "rating",
      node: (
        <RouterLink
          to="/products/$productId/reviews"
          params={{ productId: productSlug }}
          {...stylex.props(styles.ratingLink)}
        >
          {reviewCount >= MIN_REVIEWS_FOR_AVERAGE && listing.rating != null ? (
            <>
              <Star size={13} aria-hidden {...stylex.props(styles.star)} />
              {listing.rating.toFixed(1)}
              <span {...stylex.props(styles.ratingCount)}>({reviewCount})</span>
            </>
          ) : (
            formatReviewCount(reviewCount)
          )}
        </RouterLink>
      ),
    });
  }
  if (isGame) metaItems.push({ key: "game", node: <span>Game</span> });

  return (
    <header {...stylex.props(styles.root)}>
      <ListingIcon
        name={listing.name}
        src={listing.iconUrl}
        size={112}
        style={styles.icon}
      />
      <div {...stylex.props(styles.text)}>
        <h1 {...stylex.props(styles.name)}>{listing.name}</h1>
        {listing.tagline ? (
          <p {...stylex.props(styles.tagline)}>{listing.tagline}</p>
        ) : null}
        {metaItems.length > 0 ? (
          <div {...stylex.props(styles.meta)}>
            {metaItems.map((item, index) => (
              <Fragment key={item.key}>
                {index > 0 ? (
                  <span aria-hidden {...stylex.props(styles.dot)} />
                ) : null}
                {item.node}
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>
      <div {...stylex.props(styles.actions)}>
        <FavoriteButton
          listing={listing}
          productId={productId}
          productSlug={productSlug}
        />
        {listing.productAccountDid ? (
          <AriaLink
            href={`https://bsky.app/profile/${listing.productAccountDid}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${listing.name} on Bluesky`}
            {...stylex.props(iconButtonStyles, styles.iconButton)}
          >
            <BlueskyIcon />
          </AriaLink>
        ) : null}
        {primaryUrl ? (
          <ButtonLink
            to={primaryUrl}
            size="lg"
            variant={
              gameStatus === "coming" || gameStatus === "archived"
                ? "secondary"
                : "primary"
            }
            target="_blank"
            rel="noopener noreferrer"
            style={styles.primary}
          >
            {primaryLabel}
            <ArrowUpRight />
          </ButtonLink>
        ) : null}
      </div>
    </header>
  );
}

function FavoriteButton({
  listing,
  productId,
  productSlug,
}: {
  listing: DirectoryListingDetail;
  productId: string;
  productSlug: string;
}) {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const favoriteStatusQueryOptions =
    directoryListingApi.getDirectoryListingFavoriteStatusQueryOptions(
      productId,
    );
  const { data: favoriteStatus } = useQuery(favoriteStatusQueryOptions);
  const queryClient = useQueryClient();
  const profileFavoritesQueryOptions = session?.user?.did
    ? directoryListingApi.getProfileFavoriteListingsQueryOptions(
        session.user.did,
      )
    : null;
  const favoriteMutation = useMutation({
    mutationFn: async (nextIsFavorited: boolean) => {
      if (nextIsFavorited) {
        await directoryListingApi.favoriteDirectoryListing({
          data: { listingId: productId },
        });
        return;
      }
      await directoryListingApi.unfavoriteDirectoryListing({
        data: { listingId: productId },
      });
    },
    onMutate: async (nextIsFavorited: boolean) => {
      await queryClient.cancelQueries({
        queryKey: favoriteStatusQueryOptions.queryKey,
        exact: true,
      });
      const previousFavoriteStatus = queryClient.getQueryData(
        favoriteStatusQueryOptions.queryKey,
      );
      queryClient.setQueryData(favoriteStatusQueryOptions.queryKey, {
        isFavorited: nextIsFavorited,
      });
      return { previousFavoriteStatus };
    },
    onError: (_error, _nextIsFavorited, context) => {
      if (context?.previousFavoriteStatus !== undefined) {
        queryClient.setQueryData(
          favoriteStatusQueryOptions.queryKey,
          context.previousFavoriteStatus,
        );
      }
    },
    onSuccess: async (_result, nextIsFavorited) => {
      queryClient.setQueryData(favoriteStatusQueryOptions.queryKey, {
        isFavorited: nextIsFavorited,
      });
      if (profileFavoritesQueryOptions) {
        await queryClient.invalidateQueries({
          queryKey: profileFavoritesQueryOptions.queryKey,
          exact: true,
        });
      }
      globalThis.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: favoriteStatusQueryOptions.queryKey,
          exact: true,
        });
      }, 10_000);
    },
  });

  // Favorites are records in the viewer's repo pointing at the listing record.
  if (!listing.atUri?.trim()) return null;

  if (!session?.user?.did) {
    return (
      <ButtonLink
        to="/login"
        search={{ redirect: `/products/${productSlug}` }}
        variant="secondary"
        size="lg"
        style={styles.favorite}
      >
        <Heart />
        Favorite
      </ButtonLink>
    );
  }

  if (!favoriteStatus) return null;

  return (
    <ToggleButton
      variant="secondary"
      size="lg"
      isSelected={favoriteStatus.isFavorited}
      isDisabled={favoriteMutation.isPending}
      onPress={() =>
        void favoriteMutation.mutateAsync(!favoriteStatus.isFavorited)
      }
      style={styles.favorite}
    >
      <Heart
        {...stylex.props(favoriteStatus.isFavorited && styles.heartFilled)}
      />
      {favoriteStatus.isFavorited ? "Favorited" : "Favorite"}
    </ToggleButton>
  );
}
