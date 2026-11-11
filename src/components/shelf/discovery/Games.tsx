import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import type { DirectoryGameCard } from "../../../integrations/tanstack-query/api-directory-listings.functions";

import { Badge } from "../../../design-system/badge";
import { animationDuration } from "../../../design-system/theme/animations.stylex";
import { uiColor } from "../../../design-system/theme/color.stylex";
import { breakpoints } from "../../../design-system/theme/media-queries.stylex";
import { shadow } from "../../../design-system/theme/shadow.stylex";
import {
  fontFamily,
  fontWeight,
} from "../../../design-system/theme/typography.stylex";
import { getDirectoryListingSlug } from "../../../lib/directory-listing-slugs";
import {
  GAME_STATUS_LABELS,
  getGameStatus,
  getGameStatusBadgeVariant,
} from "../../../lib/game-listing";
import { GameCoverCard } from "../GameCoverCard";
import { ListingIcon } from "../ListingIcon";

const styles = stylex.create({
  feature: {
    borderColor: "light-dark(#0d0c0b, #2a2825)",
    borderRadius: { default: 18, [breakpoints.md]: 24 },
    borderStyle: "solid",
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "#0d0c0b",
    boxShadow: shadow.md,
    color: "#f5f3ee",
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "minmax(0, 1.6fr) minmax(0, 1fr)",
    },
    position: "relative",
    minHeight: { default: null, [breakpoints.md]: 360 },
  },
  frame: {
    overflow: "hidden",
    aspectRatio: { default: "16 / 9", [breakpoints.md]: "auto" },
    backgroundColor: "#1d1b18",
  },
  cover: {
    display: "block",
    objectFit: "cover",
    transform: {
      default: null,
      [stylex.when.ancestor(":hover")]: "scale(1.015)",
    },
    transitionDuration: animationDuration.extremelySlow,
    transitionProperty: "transform",
    transitionTimingFunction: "cubic-bezier(.2,.7,.2,1)",
    height: "100%",
    width: "100%",
  },
  copy: {
    padding: { default: 24, [breakpoints.md]: 40 },
    alignItems: "flex-start",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#a8a296",
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginTop: 20,
  },
  name: {
    margin: 0,
    marginBlock: 8,
    fontFamily: fontFamily.title,
    fontSize: { default: 32, [breakpoints.md]: 44 },
    fontWeight: 750,
    letterSpacing: "-0.045em",
    lineHeight: 1,
    textWrap: "balance",
  },
  // Stretched link: the whole panel opens the listing, the Play button sits above it.
  nameLink: {
    borderRadius: 4,
    textDecoration: "none",
    color: "inherit",
    outlineColor: "#f5f3ee",
    outlineOffset: 4,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    "::after": {
      inset: 0,
      content: "''",
      position: "absolute",
    },
  },
  tagline: {
    margin: 0,
    color: "#cfcabe",
    lineHeight: 1.5,
    marginBottom: 24,
  },
  play: {
    borderRadius: 999,
    paddingBlock: 10,
    paddingInline: 20,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: { default: "#f5f3ee", ":hover": "#ffffff" },
    color: "#111",
    columnGap: 8,
    display: "inline-flex",
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    outlineColor: "#f5f3ee",
    outlineOffset: 3,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    overflowWrap: "anywhere",
    position: "relative",
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color",
    zIndex: 1,
    maxWidth: "100%",
    minHeight: 44,
  },
  playStatic: {
    pointerEvents: "none",
  },
  tile: {
    position: "relative",
    minWidth: 0,
  },
  badge: {
    pointerEvents: "none",
    position: "absolute",
    left: 10,
    top: 10,
  },
  byline: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 2,
    paddingLeft: 48,
  },
});

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The most popular game as a dark cover panel with a "Play on …" button. */
export function GameFeature({ game }: { game: DirectoryGameCard }) {
  const domain = game.externalUrl ? getDomain(game.externalUrl) : null;

  return (
    <div {...stylex.props(styles.feature)}>
      <div {...stylex.props(styles.frame)}>
        <img
          alt=""
          src={game.heroImageUrl ?? undefined}
          {...stylex.props(styles.cover)}
        />
      </div>
      <div {...stylex.props(styles.copy)}>
        <ListingIcon name={game.name} src={game.iconUrl} size={64} />
        <div {...stylex.props(styles.eyebrow)}>Most popular game</div>
        <h2 {...stylex.props(styles.name)}>
          <RouterLink
            to="/products/$productId"
            params={{ productId: getDirectoryListingSlug(game) }}
            {...stylex.props(styles.nameLink)}
          >
            {game.name}
          </RouterLink>
        </h2>
        <p {...stylex.props(styles.tagline)}>{game.tagline}</p>
        {game.externalUrl && domain ? (
          <a
            href={game.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            {...stylex.props(styles.play)}
          >
            Play on {domain}
            <ArrowUpRight size={16} aria-hidden />
          </a>
        ) : (
          <span aria-hidden {...stylex.props(styles.play, styles.playStatic)}>
            View game
          </span>
        )}
      </div>
    </div>
  );
}

/** Cover card plus the status badge (unless live) and the developer byline. */
export function GameTile({ game }: { game: DirectoryGameCard }) {
  const status = getGameStatus(game.gameStatus);

  return (
    <div {...stylex.props(styles.tile)}>
      <GameCoverCard listing={game} />
      {status === "live" ? null : (
        <span {...stylex.props(styles.badge)}>
          <Badge size="sm" variant={getGameStatusBadgeVariant(status)}>
            {GAME_STATUS_LABELS[status]}
          </Badge>
        </span>
      )}
      {game.developerName ? (
        <div {...stylex.props(styles.byline)}>by {game.developerName}</div>
      ) : null}
    </div>
  );
}
