import * as stylex from "@stylexjs/stylex";
import { createLink, Link as RouterLink } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

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

  console.log(mention);
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
          {mention.postText ? <Body>{mention.postText}</Body> : null}
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
