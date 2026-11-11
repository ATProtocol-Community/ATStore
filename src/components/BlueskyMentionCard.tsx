import type { ReactNode } from "react";

import { RichText } from "@atproto/api";
import * as stylex from "@stylexjs/stylex";
import { Link as RouterLink } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import type { DirectoryListingMention } from "../integrations/tanstack-query/api-directory-listings.functions";

import { Avatar } from "../design-system/avatar";
import { animationDuration } from "../design-system/theme/animations.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { getInitials } from "../lib/get-initials";
import { formatReviewDate } from "./shelf/listing/listing-helpers";

const styles = stylex.create({
  row: {
    paddingBlock: 20,
    borderTopColor: uiColor.border1,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  who: {
    alignItems: "center",
    columnGap: 12,
    display: "flex",
    minWidth: 0,
  },
  avatarLink: {
    borderRadius: "50%",
    display: "block",
    flexShrink: 0,
  },
  avatar: {
    borderRadius: "50%",
    height: 38,
    width: 38,
  },
  whoText: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
  },
  name: {
    overflow: "hidden",
    color: uiColor.text2,
    display: "block",
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    textDecorationLine: { default: "none", ":hover": "underline" },
    textOverflow: "ellipsis",
    textUnderlineOffset: 3,
    whiteSpace: "nowrap",
  },
  sub: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 13,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: 1,
  },
  open: {
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component1,
    },
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color, color",
    height: 32,
    width: 32,
  },
  postText: {
    color: uiColor.text2,
    fontSize: { default: 15, [breakpoints.md]: 16 },
    lineHeight: 1.6,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    marginBottom: 0,
    marginTop: 12,
  },
  facetLink: {
    color: uiColor.text2,
    textDecorationColor: uiColor.border3,
    textDecorationLine: "underline",
    textUnderlineOffset: 3,
  },
  embedCard: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: 14,
    borderStyle: "solid",
    borderWidth: 1,
    overflow: "hidden",
    textDecoration: "none",
    backgroundColor: uiColor.bg,
    color: "inherit",
    display: "block",
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    marginTop: 12,
    maxWidth: 420,
  },
  embedThumb: {
    display: "block",
    objectFit: "cover",
    height: 140,
    width: "100%",
  },
  embedBody: {
    paddingBlock: 12,
    paddingInline: 14,
    display: "flex",
    flexDirection: "column",
    rowGap: 4,
  },
  embedTitle: {
    color: uiColor.text2,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  embedDescription: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    color: uiColor.text1,
    display: "-webkit-box",
    fontSize: 13,
    lineHeight: 1.45,
  },
  embedUrl: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 12,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

function hostOf(uri: string) {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
}

function mentionAuthorLabel(mention: DirectoryListingMention): string {
  return (
    mention.authorDisplayName?.trim() ||
    mention.authorHandle?.trim() ||
    (mention.authorDid.length > 16
      ? `${mention.authorDid.slice(0, 10)}…`
      : mention.authorDid)
  );
}

function renderPostText(mention: DirectoryListingMention) {
  const text = mention.postText;
  if (!text) return null;
  const facets = mention.postFacets;
  if (!facets || facets.length === 0) {
    return <p {...stylex.props(styles.postText)}>{text}</p>;
  }

  const richText = new RichText({
    text,
    facets: facets as ConstructorParameters<typeof RichText>[0]["facets"],
  });

  const parts: Array<ReactNode> = [];
  let i = 0;
  for (const segment of richText.segments()) {
    const key = `segment-${i++}`;
    if (segment.isLink() && segment.link?.uri) {
      parts.push(
        <a
          key={key}
          href={segment.link.uri}
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.facetLink)}
        >
          {segment.text}
        </a>,
      );
      continue;
    }
    if (segment.isMention() && segment.mention?.did) {
      parts.push(
        <a
          key={key}
          href={`https://bsky.app/profile/${segment.mention.did}`}
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.facetLink)}
        >
          {segment.text}
        </a>,
      );
      continue;
    }
    if (segment.isTag() && segment.tag?.tag) {
      parts.push(
        <a
          key={key}
          href={`https://bsky.app/hashtag/${encodeURIComponent(segment.tag.tag)}`}
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.facetLink)}
        >
          {segment.text}
        </a>,
      );
      continue;
    }
    parts.push(<span key={key}>{segment.text}</span>);
  }

  return <p {...stylex.props(styles.postText)}>{parts}</p>;
}

/** A Bluesky post that mentions a listing, as a row between hairlines. */
export function BlueskyMentionCard({
  mention,
}: {
  mention: DirectoryListingMention;
}) {
  const href = mention.bskyPostUrl ?? undefined;
  const authorLabel = mentionAuthorLabel(mention);
  const handlePlain = mention.authorHandle?.replace(/^@/, "").trim() ?? "";
  const displayName = mention.authorDisplayName?.trim();
  const showHandle =
    handlePlain.length > 0 &&
    (displayName ?? "").toLowerCase() !== handlePlain.toLowerCase();
  const embed = mention.postEmbed;

  return (
    <article {...stylex.props(styles.row)}>
      <div {...stylex.props(styles.who)}>
        <RouterLink
          to="/profile/$actor"
          params={{ actor: mention.authorDid }}
          aria-hidden
          tabIndex={-1}
          {...stylex.props(styles.avatarLink)}
        >
          <Avatar
            alt={authorLabel}
            fallback={getInitials(authorLabel)}
            src={mention.authorAvatarUrl || undefined}
            style={styles.avatar}
          />
        </RouterLink>
        <div {...stylex.props(styles.whoText)}>
          <RouterLink
            to="/profile/$actor"
            params={{ actor: mention.authorDid }}
            {...stylex.props(styles.name)}
          >
            {authorLabel}
          </RouterLink>
          <div {...stylex.props(styles.sub)}>
            {showHandle ? `@${handlePlain} · ` : ""}
            <time dateTime={mention.postCreatedAt}>
              {formatReviewDate(mention.postCreatedAt)}
            </time>
          </div>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label="Open post on Bluesky"
            {...stylex.props(styles.open)}
          >
            <ArrowUpRight size={16} aria-hidden />
          </a>
        ) : null}
      </div>
      {renderPostText(mention)}
      {embed ? (
        <a
          href={embed.uri}
          target="_blank"
          rel="noreferrer"
          {...stylex.props(styles.embedCard)}
        >
          {embed.thumbUrl ? (
            <img
              alt=""
              src={embed.thumbUrl}
              loading="lazy"
              {...stylex.props(styles.embedThumb)}
            />
          ) : null}
          <span {...stylex.props(styles.embedBody)}>
            {embed.title ? (
              <span {...stylex.props(styles.embedTitle)}>{embed.title}</span>
            ) : null}
            {embed.description ? (
              <span {...stylex.props(styles.embedDescription)}>
                {embed.description}
              </span>
            ) : null}
            <span {...stylex.props(styles.embedUrl)}>{hostOf(embed.uri)}</span>
          </span>
        </a>
      ) : null}
    </article>
  );
}
