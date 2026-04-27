import * as stylex from "@stylexjs/stylex";
import { createFileRoute, createLink } from "@tanstack/react-router";

import { Flex } from "../design-system/flex";
import { Link } from "../design-system/link";
import { Page } from "../design-system/page";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import { uiColor } from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import {
  fontSize,
  lineHeight,
  tracking,
} from "../design-system/theme/typography.stylex";
import {
  Body,
  Heading1,
  Heading2,
  Heading3,
} from "../design-system/typography";
import { buildRouteOgMeta } from "../lib/og-meta";
import { Text } from "#/design-system/typography/text.tsx";

const LinkLink = createLink(Link);

export const Route = createFileRoute("/_header-layout/about")({
  head: () =>
    buildRouteOgMeta({
      title: "About | ATStore",
      description:
        "ATStore is an open directory of apps, services, and tools built on the AT Protocol. Learn what it is, why it exists, how it works, and how to get in touch.",
    }),
  component: AboutPage,
});

const styles = stylex.create({
  page: {
    paddingBottom: verticalSpace["10xl"],
    paddingTop: verticalSpace["6xl"],
  },
  heading1: {
    fontSize: {
      default: fontSize["4xl"],
      [breakpoints.md]: fontSize["6xl"],
    },
    letterSpacing: tracking.tight,
    lineHeight: lineHeight.sm,
    margin: 0,
  },
  lede: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.base,
    maxWidth: "44rem",
  },
  section: {
    gap: gap["6xl"],
  },
  sectionsStack: {
    gap: {
      default: gap["7xl"],
      [breakpoints.md]: gap["8xl"],
    },
  },
  callout: {
    backgroundColor: uiColor.bgSubtle,
    borderColor: uiColor.border1,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingTop: verticalSpace["3xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
    gap: gap["4xl"],
  },
  twoColItem: {
    flex: 1,
    minWidth: 0,
    gap: gap["4xl"],
  },
});

function AboutPage() {
  return (
    <Page.Root variant="small" style={styles.page}>
      <Flex direction="column" style={styles.sectionsStack}>
        <Flex direction="column" gap="7xl">
          <Heading1 style={styles.heading1}>
            An open directory for the open social web.
          </Heading1>
          <Body style={styles.lede} variant="secondary">
            ATStore is a community-run directory of the apps, services, and
            tools being built on the{" "}
            <Link href="https://atproto.com" target="_blank" rel="noreferrer">
              AT Protocol
            </Link>
            . It exists to make the Atmosphere easier to discover, easier to
            navigate, and easier to contribute to, for users and builders alike.
          </Body>
        </Flex>

        <Flex direction="column" style={styles.section}>
          <Heading2>What ATStore is</Heading2>
          <Body>
            ATStore is a public directory of ATProto apps and the tools and apps
            that are built on top of them. Think Bluesky and friends, plus the
            growing ecosystem of clients, viewers, analytics, and other things
            people make on top of those apps&rsquo; data. Each listing has a
            profile page, categories, ratings, reviews, and links out to the
            real product.
          </Body>
          <Body>
            Listings live as records on the AT Protocol itself, under the{" "}
            <Link
              href="https://github.com/hipstersmoothie/ATStore/tree/main/lexicons"
              target="_blank"
              rel="noreferrer"
            >
              <code>fyi.atstore.*</code>
            </Link>{" "}
            lexicons. The site you&rsquo;re looking at is one view over that
            data — anyone is free to build their own.
          </Body>
        </Flex>

        <Flex direction="column" style={styles.section}>
          <Heading2>Why it exists</Heading2>
          <Body>
            The Atmosphere is growing quickly, but most of it is scattered
            across GitHub repos, Bluesky posts, group chats, and personal
            spreadsheets. New users have a hard time finding apps; new
            developers have a hard time finding what already exists.
          </Body>
          <Body>
            ATStore is an attempt to fix that with a single, opinionated,
            community-curated index — without becoming another walled garden.
            The data is open, the lexicons are open, the categories are
            community-defined, and any project that fits the protocol is
            welcome.
          </Body>
        </Flex>

        <Flex direction="column" style={styles.section}>
          <Heading2>How it works</Heading2>
          <Body>
            ATStore is built on the same primitives as the apps it lists:
          </Body>
          <Flex direction="column" gap="6xl">
            <Flex direction="column" style={styles.twoColItem}>
              <Heading3>Listings as records</Heading3>
              <Body variant="secondary">
                Every product is a <code>fyi.atstore.listing.detail</code>{" "}
                record on someone&rsquo;s PDS. ATStore ingests these records via
                a tap-sync consumer, so the directory stays in sync with whoever
                owns the listing.
              </Body>
            </Flex>
            <Flex direction="column" style={styles.twoColItem}>
              <Heading3>Claiming your listing</Heading3>
              <Body variant="secondary">
                Anyone with an ATProto account can claim and manage the listing
                for a product they represent. Once claimed, the listing&rsquo;s
                record lives on the owner&rsquo;s PDS — not ours — so it&rsquo;s
                portable and revocable.
              </Body>
            </Flex>
            <Flex direction="column" style={styles.twoColItem}>
              <Heading3>Reviews &amp; trending</Heading3>
              <Body variant="secondary">
                Reviews are public records too. A separate consumer watches
                Bluesky for posts that mention listings to surface what the
                community is actually using and talking about right now.
              </Body>
            </Flex>
            <Flex direction="column" style={styles.twoColItem}>
              <Heading3>Categories &amp; tags</Heading3>
              <Body variant="secondary">
                Listings are organized by the app they build on (e.g. Bluesky)
                and by cross-cutting workflow tags like analytics, moderation,
                or automation. Browse by whatever lens fits the question
                you&rsquo;re asking.
              </Body>
            </Flex>
          </Flex>
        </Flex>

        <Flex direction="column" style={styles.section}>
          <Heading2>Who built it &amp; who runs it</Heading2>
          <Body>
            ATStore was built by{" "}
            <Link
              href="https://github.com/hipstersmoothie"
              target="_blank"
              rel="noreferrer"
            >
              Andrew Lisowski
            </Link>
            , an independent developer working on tools for the open social web.
          </Body>
          <Body>
            It&rsquo;s maintained as a community project under the{" "}
            <Link
              href="https://atproto.wiki/en/home"
              target="_blank"
              rel="noreferrer"
            >
              AT Protocol Community
            </Link>{" "}
            — a community-hosted, community-moderated home for AT Protocol
            documentation, working groups, and shared infrastructure. Editorial
            decisions about categories, taxonomy, and curation happen in the
            open alongside the wider community.
          </Body>
        </Flex>

        <Flex direction="column" style={styles.callout}>
          <Heading2>Get in touch</Heading2>
          <Body variant="secondary">
            Found a bug, want to suggest a category, or think a listing is
            missing or wrong? We&rsquo;d love to hear from you.
          </Body>
          <Flex direction="column" gap="3xl">
            <Body>
              <strong>Submit a listing.</strong> If you build on ATProto,{" "}
              <LinkLink to="/products/create">add your product</LinkLink> to the
              directory. It only takes a minute.
            </Body>
            <Body>
              <Text weight="bold">On Bluesky.</Text> Reach out to{" "}
              <Link
                href="https://bsky.app/profile/atstore.fyi"
                target="_blank"
                rel="noreferrer"
              >
                @atstore.fyi
              </Link>{" "}
              with feedback, corrections, or suggestions.
            </Body>
            <Body>
              <strong>Open source.</strong> File issues or open a PR on{" "}
              <Link
                href="https://github.com/ATProtocol-Community/ATStore"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </Link>
              .
            </Body>
            <Body>
              <strong>Community.</strong> Join the conversation on the{" "}
              <Link
                href="https://atproto.wiki/en/home"
                target="_blank"
                rel="noreferrer"
              >
                AT Protocol Community
              </Link>
              .
            </Body>
          </Flex>
        </Flex>
      </Flex>
    </Page.Root>
  );
}
