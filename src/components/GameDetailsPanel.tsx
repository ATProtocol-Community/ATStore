import * as stylex from "@stylexjs/stylex";
import { ExternalLink } from "lucide-react";

import type {
  GameDetails,
  GameRecordRef,
  GameTrailer,
} from "../lib/atproto/game-define-record";

import { AspectRatio } from "../design-system/aspect-ratio";
import { Badge } from "../design-system/badge";
import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import {
  ATMOSPHERE_GAMES_URL,
  GAME_STATUS_LABELS,
  getGameCategoryLabel,
  getGameStatus,
  getGameStatusBadgeVariant,
} from "../lib/game-listing";

/**
 * atmosphere.games data on a game's product page: status, developer and release facts,
 * trailers, and the AT Protocol records the game reads or requires.
 *
 * Everything here comes from the developer's `games.atmosphere.define` record, so every URL is
 * checked before it becomes a link or an embed.
 */

const styles = stylex.create({
  section: {
    paddingTop: verticalSpace["5xl"],
  },
  header: {
    alignItems: "center",
    display: "flex",
    height: size["3xl"],
  },
  facts: {
    margin: 0,
    columnGap: gap["4xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.sm]: "max-content minmax(0, 1fr)",
    },
    rowGap: {
      default: gap.md,
      [breakpoints.sm]: gap["2xl"],
    },
  },
  factTerm: {
    color: uiColor.text1,
    paddingTop: {
      default: verticalSpace.md,
      [breakpoints.sm]: 0,
    },
  },
  factValue: {
    margin: 0,
    alignItems: "center",
    columnGap: gap.md,
    display: "flex",
    flexWrap: "wrap",
    rowGap: gap.md,
    minWidth: 0,
  },
  trailerGrid: {
    gap: gap["2xl"],
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
    },
  },
  trailerFrame: {
    borderWidth: 0,
    backgroundColor: uiColor.component1,
    display: "block",
    height: "100%",
    width: "100%",
  },
  recordList: {
    margin: 0,
    padding: 0,
    gap: gap.xl,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
  },
  recordItem: {
    borderColor: uiColor.border1,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: 1,
    gap: gap.md,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    paddingBottom: verticalSpace["2xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    paddingTop: verticalSpace["2xl"],
  },
  recordHeader: {
    flexWrap: "wrap",
    rowGap: gap.sm,
  },
  nsid: {
    overflowWrap: "anywhere",
  },
});

const VIDEO_ID_PATTERN = /^[\w-]+$/;

/** Only http(s) URLs from third-party records become links or media sources. */
function safeHttpUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function getDeveloperHref(developer: GameDetails["developer"]): string | null {
  if (!developer) return null;
  if (developer.did?.startsWith("did:")) {
    return `https://bsky.app/profile/${developer.did}`;
  }
  return safeHttpUrl(developer.url);
}

/** `releasedAt` may be a full date or just a year / year-month. */
function formatReleasedAt(releasedAt: string): string {
  if (/^\d{4}$/.test(releasedAt)) return releasedAt;
  const time = Date.parse(releasedAt);
  if (Number.isNaN(time)) return releasedAt;
  const date = new Date(time);
  return /^\d{4}-\d{2}$/.test(releasedAt)
    ? date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        timeZone: "UTC",
      })
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
}

export function GameDetailsPanel({
  game,
  gameName,
  isGameOnly,
}: {
  game: GameDetails;
  gameName: string;
  /** Game-only listings are managed on atmosphere.games, not here. */
  isGameOnly: boolean;
}) {
  return (
    <Flex direction="column" gap="4xl">
      <GameFactsSection game={game} />
      <GameTrailersSection trailers={game.trailers} gameName={gameName} />
      <GameRecordsSection requires={game.requires} uses={game.uses} />
      <SmallBody variant="secondary">
        Listed from{" "}
        <Link
          href={ATMOSPHERE_GAMES_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          atmosphere.games
        </Link>
        {isGameOnly
          ? ". The developer manages this listing there."
          : ", alongside this app's AT Store listing."}
      </SmallBody>
    </Flex>
  );
}

function GameFactsSection({ game }: { game: GameDetails }) {
  const status = getGameStatus(game.status);
  const developerHref = getDeveloperHref(game.developer);

  return (
    <Flex direction="column" gap="3xl" style={styles.section}>
      <Text size="2xl" weight="semibold" style={styles.header}>
        Game
      </Text>
      <dl {...stylex.props(styles.facts)}>
        <Fact term="Status">
          <Badge size="sm" variant={getGameStatusBadgeVariant(status)}>
            {GAME_STATUS_LABELS[status]}
          </Badge>
        </Fact>
        {game.category ? (
          <Fact term="Category">
            <Body>{getGameCategoryLabel(game.category)}</Body>
          </Fact>
        ) : null}
        {game.developer ? (
          <Fact term="Developer">
            {developerHref ? (
              <Link
                href={developerHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {game.developer.name}
              </Link>
            ) : (
              <Body>{game.developer.name}</Body>
            )}
          </Fact>
        ) : null}
        {game.releasedAt ? (
          <Fact term="Released">
            <Body>{formatReleasedAt(game.releasedAt)}</Body>
          </Fact>
        ) : null}
        {game.tags.length > 0 ? (
          <Fact term="Tags">
            {game.tags.map((tag) => (
              <Badge key={tag} size="sm">
                {tag}
              </Badge>
            ))}
          </Fact>
        ) : null}
      </dl>
    </Flex>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <>
      <dt {...stylex.props(styles.factTerm)}>
        <Body variant="secondary">{term}</Body>
      </dt>
      <dd {...stylex.props(styles.factValue)}>{children}</dd>
    </>
  );
}

function GameTrailersSection({
  trailers,
  gameName,
}: {
  trailers: Array<GameTrailer>;
  gameName: string;
}) {
  const playable = trailers.filter(
    (trailer) => getTrailerEmbedSrc(trailer) || getTrailerLink(trailer),
  );
  if (playable.length === 0) return null;

  return (
    <Flex direction="column" gap="3xl" style={styles.section}>
      <Text size="2xl" weight="semibold" style={styles.header}>
        {playable.length === 1 ? "Trailer" : "Trailers"}
      </Text>
      <div {...stylex.props(styles.trailerGrid)}>
        {playable.map((trailer, index) => (
          <TrailerPlayer
            key={`${trailer.platform ?? "video"}-${trailer.videoId ?? trailer.url ?? ""}-${String(index)}`}
            trailer={trailer}
            gameName={gameName}
          />
        ))}
      </div>
    </Flex>
  );
}

/** Privacy-friendly embed URL for YouTube / Vimeo trailers; null for anything else. */
function getTrailerEmbedSrc(trailer: GameTrailer): string | null {
  const id = trailer.videoId?.trim();
  if (!id || !VIDEO_ID_PATTERN.test(id)) return null;
  switch (trailer.platform) {
    case "youtube": {
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    case "vimeo": {
      return `https://player.vimeo.com/video/${id}`;
    }
    default: {
      return null;
    }
  }
}

function getTrailerLink(trailer: GameTrailer): string | null {
  const url = safeHttpUrl(trailer.url);
  if (url) return url;
  const id = trailer.videoId?.trim();
  if (!id || !VIDEO_ID_PATTERN.test(id)) return null;
  switch (trailer.platform) {
    case "youtube": {
      return `https://www.youtube.com/watch?v=${id}`;
    }
    case "vimeo": {
      return `https://vimeo.com/${id}`;
    }
    case "twitch": {
      return `https://www.twitch.tv/videos/${id}`;
    }
    default: {
      return null;
    }
  }
}

function TrailerPlayer({
  trailer,
  gameName,
}: {
  trailer: GameTrailer;
  gameName: string;
}) {
  const title = `${gameName}: ${trailer.title}`;
  const embedSrc = getTrailerEmbedSrc(trailer);
  const link = getTrailerLink(trailer);

  if (embedSrc) {
    return (
      <Flex direction="column" gap="lg">
        <AspectRatio aspectRatio={16 / 9}>
          <iframe
            src={embedSrc}
            title={title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            {...stylex.props(styles.trailerFrame)}
          />
        </AspectRatio>
        <SmallBody variant="secondary">{trailer.title}</SmallBody>
      </Flex>
    );
  }

  if (trailer.platform === "direct" && link) {
    return (
      <Flex direction="column" gap="lg">
        <AspectRatio aspectRatio={16 / 9}>
          {/* Trailer records carry no caption tracks to attach. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            controls
            preload="none"
            src={link}
            poster={safeHttpUrl(trailer.thumbnailUrl) ?? undefined}
            title={title}
            {...stylex.props(styles.trailerFrame)}
          />
        </AspectRatio>
        <SmallBody variant="secondary">{trailer.title}</SmallBody>
      </Flex>
    );
  }

  // Twitch (needs the embedding host's domain) and unknown platforms open in a new tab.
  return link ? (
    <Link href={link} target="_blank" rel="noopener noreferrer">
      {trailer.title}
      <ExternalLink />
    </Link>
  ) : null;
}

function GameRecordsSection({
  requires,
  uses,
}: {
  requires: Array<GameRecordRef>;
  uses: Array<GameRecordRef>;
}) {
  if (requires.length === 0 && uses.length === 0) return null;

  return (
    <Flex direction="column" gap="3xl" style={styles.section}>
      <Flex direction="column" gap="lg">
        <Text size="2xl" weight="semibold" style={styles.header}>
          AT Protocol records
        </Text>
        <Body variant="secondary">
          Data this game reads from or writes to your account.
        </Body>
      </Flex>
      {requires.length > 0 ? (
        <GameRecordList title="Required to play" records={requires} />
      ) : null}
      {uses.length > 0 ? <GameRecordList title="Uses" records={uses} /> : null}
    </Flex>
  );
}

function GameRecordList({
  title,
  records,
}: {
  title: string;
  records: Array<GameRecordRef>;
}) {
  return (
    <Flex direction="column" gap="xl">
      <Text size="lg" weight="semibold">
        {title}
      </Text>
      <ul role="list" {...stylex.props(styles.recordList)}>
        {records.map((record, index) => {
          const acquireHref = safeHttpUrl(record.acquire);
          return (
            <li
              key={`${record.nsid ?? record.kind}-${String(index)}`}
              {...stylex.props(styles.recordItem)}
            >
              <Flex align="center" gap="md" style={styles.recordHeader}>
                {record.nsid ? (
                  <Text font="mono" size="sm" style={styles.nsid}>
                    {record.nsid}
                  </Text>
                ) : null}
                <Badge size="sm">{record.kind}</Badge>
              </Flex>
              {record.label ? <Body>{record.label}</Body> : null}
              {record.purpose ? (
                <Body variant="secondary">{record.purpose}</Body>
              ) : null}
              {acquireHref ? (
                <Link
                  href={acquireHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How to get this
                  <ExternalLink />
                </Link>
              ) : record.acquire ? (
                <SmallBody variant="secondary">{record.acquire}</SmallBody>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Flex>
  );
}
