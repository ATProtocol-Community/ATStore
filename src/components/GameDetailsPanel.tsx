import type { ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { ArrowUpRight } from "lucide-react";

import type {
  GameDetails,
  GameRecordRef,
  GameTrailer,
} from "../lib/atproto/game-define-record";

import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import {
  ATMOSPHERE_GAMES_URL,
  GAME_STATUS_LABELS,
  getGameCategoryLabel,
  getGameStatus,
} from "../lib/game-listing";
import {
  BlockHeading,
  DetailExternalLink,
  DetailRow,
} from "./shelf/listing/ListingParts";

/**
 * atmosphere.games data on a game's product page. `GameFactRows` adds status, developer and
 * release facts to the sidebar list; `GameDetailsPanel` shows trailers and the AT Protocol
 * records the game reads or requires in the main column.
 *
 * Everything here comes from the developer's `games.atmosphere.define` record, so every URL is
 * checked before it becomes a link or an embed.
 */

const styles = stylex.create({
  section: {
    marginTop: { default: 44, [breakpoints.md]: 56 },
  },
  statusDot: {
    borderRadius: "50%",
    display: "inline-block",
    height: 7,
    marginRight: 2,
    width: 7,
  },
  statusLive: { backgroundColor: "light-dark(#2f9e62, #4cc384)" },
  statusBeta: { backgroundColor: "light-dark(#2f6fe0, #7b9bff)" },
  statusComing: { backgroundColor: "light-dark(#d08a12, #f0b44a)" },
  statusArchived: { backgroundColor: uiColor.solid1 },
  tag: {
    borderColor: uiColor.border1,
    borderRadius: 999,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 10,
    alignItems: "center",
    backgroundColor: uiColor.bg,
    color: uiColor.text1,
    display: "inline-flex",
    fontSize: 13,
    height: 26,
  },
  trailerGrid: {
    columnGap: 16,
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [breakpoints.md]: "repeat(2, minmax(0, 1fr))",
    },
    rowGap: 16,
  },
  trailer: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
  },
  trailerFrame: {
    borderRadius: 14,
    borderWidth: 0,
    aspectRatio: "16 / 9",
    backgroundColor: uiColor.component1,
    display: "block",
    width: "100%",
  },
  caption: {
    color: uiColor.text1,
    fontSize: 13,
  },
  lede: {
    color: uiColor.text1,
    fontSize: 15,
    lineHeight: 1.5,
    marginBottom: 18,
    marginTop: -6,
  },
  groupTitle: {
    color: uiColor.text2,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
    marginTop: 18,
  },
  recordList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  record: {
    paddingBlock: 14,
    display: "flex",
    flexDirection: "column",
    rowGap: 4,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
    minWidth: 0,
  },
  recordHead: {
    alignItems: "baseline",
    columnGap: 8,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 4,
  },
  nsid: {
    color: uiColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: 13,
    overflowWrap: "anywhere",
  },
  kind: {
    color: uiColor.text1,
    fontSize: 12,
  },
  recordLabel: {
    color: uiColor.text2,
    fontSize: 15,
  },
  recordPurpose: {
    color: uiColor.text1,
    fontSize: 14,
    lineHeight: 1.5,
  },
  link: {
    alignItems: "center",
    alignSelf: "flex-start",
    color: uiColor.text2,
    columnGap: 2,
    display: "inline-flex",
    fontSize: 14,
    textDecorationColor: {
      default: uiColor.border2,
      ":hover": uiColor.text2,
    },
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
  },
  note: {
    color: uiColor.text1,
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 0,
    marginTop: { default: 32, [breakpoints.md]: 40 },
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

const STATUS_DOT_STYLES = {
  live: styles.statusLive,
  beta: styles.statusBeta,
  coming: styles.statusComing,
  archived: styles.statusArchived,
} as const;

/** Game facts as sidebar definition-list rows. */
export function GameFactRows({ game }: { game: GameDetails }) {
  const status = getGameStatus(game.status);
  const developerHref = getDeveloperHref(game.developer);

  return (
    <>
      <DetailRow term="Status">
        <span
          aria-hidden
          {...stylex.props(styles.statusDot, STATUS_DOT_STYLES[status])}
        />
        {GAME_STATUS_LABELS[status]}
      </DetailRow>
      {game.category ? (
        <DetailRow term="Platform">
          {getGameCategoryLabel(game.category)}
        </DetailRow>
      ) : null}
      {game.developer ? (
        <DetailRow term="Developer">
          {developerHref ? (
            <DetailExternalLink href={developerHref}>
              {game.developer.name}
            </DetailExternalLink>
          ) : (
            game.developer.name
          )}
        </DetailRow>
      ) : null}
      {game.releasedAt ? (
        <DetailRow term="Released">
          {formatReleasedAt(game.releasedAt)}
        </DetailRow>
      ) : null}
      {game.tags.length > 0 ? (
        <DetailRow term="Genre">
          {game.tags.map((tag) => (
            <span key={tag} {...stylex.props(styles.tag)}>
              {tag}
            </span>
          ))}
        </DetailRow>
      ) : null}
    </>
  );
}

/** Trailers, AT Protocol records and provenance note for the main column. */
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
    <>
      <GameTrailersSection trailers={game.trailers} gameName={gameName} />
      <GameRecordsSection requires={game.requires} uses={game.uses} />
      <p {...stylex.props(styles.note)}>
        Listed from{" "}
        <a
          href={ATMOSPHERE_GAMES_URL}
          target="_blank"
          rel="noopener noreferrer"
          {...stylex.props(styles.link)}
        >
          atmosphere.games
        </a>
        {isGameOnly
          ? ". The developer manages this listing there."
          : ", alongside this app's AT Store listing."}
      </p>
    </>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section {...stylex.props(styles.section)}>{children}</section>;
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
    <Section>
      <BlockHeading>
        {playable.length === 1 ? "Trailer" : "Trailers"}
      </BlockHeading>
      <div {...stylex.props(styles.trailerGrid)}>
        {playable.map((trailer, index) => (
          <TrailerPlayer
            key={`${trailer.platform ?? "video"}-${trailer.videoId ?? trailer.url ?? ""}-${String(index)}`}
            trailer={trailer}
            gameName={gameName}
          />
        ))}
      </div>
    </Section>
  );
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
      <div {...stylex.props(styles.trailer)}>
        <iframe
          src={embedSrc}
          title={title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          {...stylex.props(styles.trailerFrame)}
        />
        <span {...stylex.props(styles.caption)}>{trailer.title}</span>
      </div>
    );
  }

  if (trailer.platform === "direct" && link) {
    return (
      <div {...stylex.props(styles.trailer)}>
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
        <span {...stylex.props(styles.caption)}>{trailer.title}</span>
      </div>
    );
  }

  // Twitch (needs the embedding host's domain) and unknown platforms open in a new tab.
  return link ? (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      {...stylex.props(styles.link)}
    >
      {trailer.title}
      <ArrowUpRight size={14} aria-hidden />
    </a>
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
    <Section>
      <BlockHeading>AT Protocol records</BlockHeading>
      <p {...stylex.props(styles.lede)}>
        Data this game reads from or writes to your account.
      </p>
      {requires.length > 0 ? (
        <GameRecordList title="Required to play" records={requires} />
      ) : null}
      {uses.length > 0 ? <GameRecordList title="Uses" records={uses} /> : null}
    </Section>
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
    <div>
      <h3 {...stylex.props(styles.groupTitle)}>{title}</h3>
      <ul role="list" {...stylex.props(styles.recordList)}>
        {records.map((record, index) => {
          const acquireHref = safeHttpUrl(record.acquire);
          return (
            <li
              key={`${record.nsid ?? record.kind}-${String(index)}`}
              {...stylex.props(styles.record)}
            >
              <div {...stylex.props(styles.recordHead)}>
                {record.nsid ? (
                  <span {...stylex.props(styles.nsid)}>{record.nsid}</span>
                ) : null}
                <span {...stylex.props(styles.kind)}>{record.kind}</span>
              </div>
              {record.label ? (
                <span {...stylex.props(styles.recordLabel)}>
                  {record.label}
                </span>
              ) : null}
              {record.purpose ? (
                <span {...stylex.props(styles.recordPurpose)}>
                  {record.purpose}
                </span>
              ) : null}
              {acquireHref ? (
                <a
                  href={acquireHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...stylex.props(styles.link)}
                >
                  How to get this
                  <ArrowUpRight size={14} aria-hidden />
                </a>
              ) : record.acquire ? (
                <span {...stylex.props(styles.recordPurpose)}>
                  {record.acquire}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
