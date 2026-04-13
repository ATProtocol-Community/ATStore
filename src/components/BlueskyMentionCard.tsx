import * as stylex from "@stylexjs/stylex";
import { RichText } from "@atproto/api";
import { createLink, Link as RouterLink } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import type { DirectoryListingMention } from "../integrations/tanstack-query/api-directory-listings.functions";
import { Avatar } from "../design-system/avatar";
import {
  Card,
  CardBody,
  CardHeader,
  CardHeaderAction,
} from "../design-system/card";
import { Flex } from "../design-system/flex";
import { radius } from "../design-system/theme/radius.stylex";
import { Body, SmallBody } from "../design-system/typography";
import { Text } from "../design-system/typography/text";
import { getInitials } from "../lib/product-reviews-route";
import { verticalSpace } from "../design-system/theme/semantic-spacing.stylex";
import { IconButton } from "#/design-system/icon-button";
import { uiColor } from "../design-system/theme/color.stylex";

const IconButtonLink = createLink(IconButton);

const styles = stylex.create({
  mentionCard: {
    borderColor: uiColor.component2,
    borderTopWidth: {
      default: 0,
      ":first-child": 1,
    },
    borderTopLeftRadius: {
      default: 0,
      ":first-child": radius.lg,
    },
    borderTopRightRadius: {
      default: 0,
      ":first-child": radius.lg,
    },
    borderBottomRightRadius: {
      default: 0,
      ":last-child": radius.lg,
    },
    borderBottomLeftRadius: {
      default: 0,
      ":last-child": radius.lg,
    },
  },
  mentionProfileLink: {
    borderRadius: radius.md,
    color: "inherit",
    flex: 1,
    minWidth: 0,
    outlineOffset: 2,
    textDecoration: "none",
  },
  mentionAuthorRow: {
    minWidth: 0,
  },
  mentionAuthorTextColumn: {
    minWidth: 0,
  },
  mentionPostText: {
    paddingTop: verticalSpace["md"],
  },
  postText: {
    whiteSpace: "pre-wrap",
  },
  facetLink: {
    color: uiColor.primary,
    textDecoration: "underline",
  },
  embedCard: {
    borderColor: uiColor.component2,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    color: "inherit",
    overflow: "hidden",
    textDecoration: "none",
    maxWidth: 400,
  },
  embedThumb: {
    display: "block",
    height: 120,
    objectFit: "cover",
    width: "100%",
    aspectRatio: 16 / 9,
  },
  embedBody: {
    padding: verticalSpace["3xl"],
  },
  embedUrl: {
    overflowWrap: "anywhere",
  },
});

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
    return <Body style={styles.postText}>{text}</Body>;
  }

  const richText = new RichText({
    text,
    facets: facets as ConstructorParameters<typeof RichText>[0]["facets"],
  });

  const parts: ReactNode[] = [];
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

  return <Body style={styles.postText}>{parts}</Body>;
}

export function BlueskyMentionCard({
  mention,
}: {
  mention: DirectoryListingMention;
}) {
  const href = mention.bskyPostUrl ?? undefined;
  const authorLabel = mentionAuthorLabel(mention);
  const handlePlain = mention.authorHandle?.replace(/^@/, "").trim() ?? "";
  const displayName = mention.authorDisplayName?.trim();
  const showHandleSubline =
    Boolean(displayName) &&
    handlePlain.length > 0 &&
    displayName!.toLowerCase() !== handlePlain.toLowerCase();
  const embed = mention.postEmbed;
  return (
    <Card size="lg" style={styles.mentionCard}>
      <CardHeader>
        <RouterLink
          to="/profile/$actor"
          params={{ actor: mention.authorDid }}
          {...stylex.props(styles.mentionProfileLink)}
        >
          <Flex align="center" gap="2xl" style={styles.mentionAuthorRow}>
            <Avatar
              alt={authorLabel}
              fallback={getInitials(authorLabel)}
              src={mention.authorAvatarUrl || undefined}
            />
            <Flex
              direction="column"
              gap="lg"
              style={styles.mentionAuthorTextColumn}
            >
              <Text size="base" weight="semibold">
                {authorLabel}
              </Text>
              {showHandleSubline ? (
                <Text size="sm" variant="secondary">
                  @{handlePlain}
                </Text>
              ) : null}
            </Flex>
          </Flex>
        </RouterLink>
        <CardHeaderAction>
          {href ? (
            <IconButtonLink
              to={href}
              target="_blank"
              variant="tertiary"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
            </IconButtonLink>
          ) : null}
        </CardHeaderAction>
      </CardHeader>
      <CardBody>
        <Flex direction="column" gap="4xl" style={styles.mentionPostText}>
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
                  {...stylex.props(styles.embedThumb)}
                />
              ) : null}
              <Flex direction="column" gap="lg" style={styles.embedBody}>
                {embed.title ? (
                  <Text size="sm" weight="semibold">
                    {embed.title}
                  </Text>
                ) : null}
                {embed.description ? (
                  <SmallBody variant="secondary">{embed.description}</SmallBody>
                ) : null}
                <SmallBody variant="secondary" style={styles.embedUrl}>
                  {embed.uri}
                </SmallBody>
              </Flex>
            </a>
          ) : null}
          <SmallBody variant="secondary">
            {Intl.DateTimeFormat("en-US", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(mention.postCreatedAt))}
          </SmallBody>
        </Flex>
      </CardBody>
    </Card>
  );
}
