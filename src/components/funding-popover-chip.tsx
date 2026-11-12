"use client";

/**
 * `<FundingPopoverChip/>` — pill chip on the project links row that opens a popover
 * showing the steward's at.fund channels, plans, and dependency graph. Mirrors the
 * `<ListingOAuthScopesPopoverChip/>` pattern so the funding affordance reads as one
 * more piece of project metadata alongside scopes / Germ / project links.
 */
import type {
  FundingChannelView,
  FundingDependencyView,
  FundingDetail,
  FundingPlanView,
} from "#/lib/atproto/load-funding-summaries";

import * as stylex from "@stylexjs/stylex";
import { Avatar } from "#/design-system/avatar";
import { Button } from "#/design-system/button";
import { Flex } from "#/design-system/flex";
import { Separator } from "#/design-system/separator";
import { animationDuration } from "#/design-system/theme/animations.stylex";
import {
  primaryColor,
  successColor,
  uiColor,
} from "#/design-system/theme/color.stylex";
import { radius } from "#/design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "#/design-system/theme/semantic-spacing.stylex";
import {
  fontFamily,
  fontSize,
  fontWeight,
} from "#/design-system/theme/typography.stylex";
import { Text } from "#/design-system/typography/text";
import {
  deriveChannelLabel,
  formatFundingAmount,
} from "#/lib/atproto/fund-format";
import { urlsMatch } from "#/lib/atproto/load-funding-summaries";
import { getInitials } from "#/lib/get-initials";
import { CreditCard, GitMerge, HeartHandshake, Package } from "lucide-react";
import { Button as AriaButton, Link as AriaLink } from "react-aria-components";

import { HoverCard } from "../design-system/hover-card";
import { green } from "../design-system/theme/colors/green.stylex";

const greenTheme = stylex.createTheme(primaryColor, {
  bg: green.bg,
  bgSubtle: green.bgSubtle,
  component1: green.component1,
  component2: green.component2,
  component3: green.component3,
  border1: green.border1,
  border2: green.border2,
  border3: green.border3,
  solid1: green.solid1,
  solid2: green.solid2,
  text1: green.text1,
  text2: green.text2,
});

const styles = stylex.create({
  channelPillIcon: {
    borderColor: successColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    alignItems: "center",
    backgroundColor: successColor.bgSubtle,
    color: successColor.text1,
    display: "flex",
    justifyContent: "center",
    height: size["3xl"],
    width: size["3xl"],
  },
  grow: {
    flexGrow: 1,
  },
  /**
   * Pill trigger for the popover — mirrors `ListingOAuthScopesPopoverChip` so the
   * Funding chip sits flush in the project-links row alongside Scopes / Germ.
   */
  chipTrigger: {
    borderColor: {
      default: uiColor.border1,
      ":hover": uiColor.border2,
    },
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: 1,
    paddingInline: 12,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: uiColor.bg,
    boxSizing: "border-box",
    color: uiColor.text2,
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: 500,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    transitionDuration: animationDuration.default,
    transitionProperty: "border-color",
    height: 30,
  },
  chipInner: {
    gap: gap.sm,
    alignItems: "center",
    display: "inline-flex",
  },
  popoverSurface: {
    maxHeight: "min(480px, 78vh)",
    maxWidth: "min(480px, 94vw)",
    overflowX: "hidden",
    overflowY: "auto",
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
  },
  /** Sub-label for the "Depends on" block (small caps, like a tag). */
  sectionLabel: {
    color: uiColor.text2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  /**
   * Pill-shaped channel/plan combo chip — same neutral palette as the surrounding
   * link chips so funding pills sit alongside other project links without competing
   * for attention.
   */
  channelPill: {
    borderColor: {
      default: uiColor.border1,
      ":is([data-hovered])": uiColor.border2,
    },
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    gap: gap["2xl"],
    paddingBlock: verticalSpace.sm,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: uiColor.bgSubtle,
      ":is([data-hovered])": uiColor.component1,
    },
    color: uiColor.text2,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingInlineEnd: horizontalSpace.md,
    paddingInlineStart: horizontalSpace.md,
    textAlign: "left",
  },
  channelPillStatic: {
    cursor: "default",
  },
  channelPillPrice: {
    borderColor: successColor.border1,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: 1,
    paddingBlock: verticalSpace.sm,
    paddingInline: horizontalSpace.md,
    backgroundColor: successColor.bgSubtle,
    color: successColor.text2,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
  },
  /** Each "Depends on" row — full row clickable, plain link semantics. */
  dependsRow: {
    borderRadius: radius.md,
    gap: gap.lg,
    paddingBlock: verticalSpace.sm,
    paddingInline: horizontalSpace.md,
    textDecoration: "none",
    alignItems: "center",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component2,
    },
    color: uiColor.text2,
    cursor: "pointer",
    display: "flex",
    marginLeft: `calc(${gap.md} * -1)`,
    marginRight: `calc(${gap.md} * -1)`,
  },
  dependsName: {
    flexGrow: 1,
    fontWeight: 600,
    minWidth: 0,
  },
  header: {
    borderBottomColor: uiColor.border2,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    height: size["4xl"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
  },
  content: {
    paddingBottom: verticalSpace["lg"],
    paddingLeft: horizontalSpace["2xl"],
    paddingRight: horizontalSpace["2xl"],
    paddingTop: verticalSpace["2xl"],
  },
});

/**
 * Index plans by the channels they reference. at.fund's design suffixes each channel
 * pill with its plan price (e.g. "Open Collective $10/mo") — denser than rendering
 * plans separately. Plans without a channel reference are surfaced as standalone pills.
 */
function buildChannelPlanIndex(
  plans: ReadonlyArray<FundingPlanView>,
): Map<string, FundingPlanView> {
  const out = new Map<string, FundingPlanView>();
  for (const plan of plans) {
    if (plan.status === "inactive") continue;
    for (const atUri of plan.channelAtUris) {
      if (!out.has(atUri)) out.set(atUri, plan);
    }
  }
  return out;
}

/**
 * Hide the chip entirely when the steward declared themselves but published nothing
 * actionable — no contribute URL, no channels/plans, no dependencies. Avoids a chip
 * that opens to an empty popover.
 */
function hasActionableFunding(funding: FundingDetail): boolean {
  return (
    Boolean(funding.contribute?.url) ||
    funding.channels.length > 0 ||
    funding.plans.length > 0 ||
    funding.dependencies.length > 0
  );
}

export function FundingPopoverChip({
  funding,
  productName,
}: {
  funding: FundingDetail | null;
  productName: string;
}) {
  if (!funding || !hasActionableFunding(funding)) return null;

  return (
    <HoverCard
      placement="bottom start"
      trigger={
        <AriaButton
          slot="trigger"
          aria-haspopup="dialog"
          aria-label={`View funding options for ${productName}`}
          {...stylex.props(styles.chipTrigger)}
        >
          <span {...stylex.props(styles.chipInner)}>
            <HeartHandshake aria-hidden size={14} strokeWidth={2} />
            <span>Funding</span>
          </span>
        </AriaButton>
      }
      style={styles.popoverSurface}
    >
      <FundingPopoverContent funding={funding} productName={productName} />
    </HoverCard>
  );
}

function FundingPopoverContent({
  funding,
  productName,
}: {
  funding: FundingDetail;
  productName: string;
}) {
  const { contribute, channels, plans, dependencies } = funding;
  const channelPlan = buildChannelPlanIndex(plans);
  const unattachedPlans = plans.filter(
    (plan) => plan.channelAtUris.length === 0 && plan.status !== "inactive",
  );
  /**
   * Show the contribute button only when the steward's `funding.contribute.url` adds
   * info beyond the channel pills — either no channels exist or none of them carry the
   * same URL. Channel URLs that already cover the contribute link would render two
   * affordances pointing at the same place, so dedupe loosely (trailing slash / case
   * insensitive) via `urlsMatch`.
   */
  const contributeUrl = contribute?.url ?? null;
  const showContributeButton =
    contributeUrl != null &&
    !channels.some((channel) => urlsMatch(channel.channelUri, contributeUrl));
  const hasChips = channels.length > 0 || unattachedPlans.length > 0;
  const showLinks = showContributeButton || hasChips;

  return (
    <Flex direction="column">
      <Flex
        align="center"
        gap="6xl"
        justify="between"
        wrap
        style={styles.header}
      >
        <Text size="base" weight="semibold">
          Funding
        </Text>
        {contributeUrl && (
          <Button
            href={contributeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Fund ${productName} (opens ${contributeUrl} in a new tab)`}
            size="sm"
            style={greenTheme as unknown as stylex.StaticStyles}
          >
            <HeartHandshake size={16} />
            {contribute?.label?.trim() || "Fund"}
          </Button>
        )}
      </Flex>

      <Flex direction="column" gap="4xl" style={styles.content}>
        {showLinks ? (
          <Flex direction="column" gap="lg">
            <Flex align="center" gap="sm" style={styles.sectionLabel}>
              <Package size={14} />
              Plans
            </Flex>
            <Flex direction="column" gap="sm">
              {channels.map((channel) => (
                <FundingChannelPill
                  key={channel.atUri}
                  channel={channel}
                  plan={channelPlan.get(channel.atUri) ?? null}
                />
              ))}
              {unattachedPlans.map((plan) => (
                <FundingPlanPill key={plan.atUri} plan={plan} />
              ))}
            </Flex>
          </Flex>
        ) : null}

        {dependencies.length > 0 ? (
          <>
            {showLinks && <Separator />}
            <Flex direction="column" gap="lg">
              <Flex align="center" gap="sm" style={styles.sectionLabel}>
                <GitMerge size={14} />
                Depends on
              </Flex>
              <Flex direction="column" gap="xs">
                {dependencies.map((dep) => (
                  <FundingDependencyRow key={dep.atUri} dependency={dep} />
                ))}
              </Flex>
            </Flex>
          </>
        ) : null}
      </Flex>
    </Flex>
  );
}

function FundingChannelPill({
  channel,
  plan,
}: {
  channel: FundingChannelView;
  plan: FundingPlanView | null;
}) {
  const label = deriveChannelLabel(channel);
  const price = plan
    ? formatFundingAmount(plan.amount, plan.currency, plan.frequency)
    : null;
  const isLink =
    channel.channelUri && /^https?:/.test(channel.channelUri.trim());

  const inner = (
    <>
      <Flex align="center" gap="lg" style={styles.grow}>
        <div {...stylex.props(styles.channelPillIcon)}>
          <CreditCard size={16} />
        </div>
        <Flex gap="xs" direction="column">
          <span>{label}</span>
          {channel.description ? <span>{channel.description}</span> : null}
        </Flex>
      </Flex>
      {price ? (
        <span {...stylex.props(styles.channelPillPrice)}>{price}</span>
      ) : null}
    </>
  );

  if (isLink && channel.channelUri) {
    return (
      <AriaLink
        href={channel.channelUri}
        target="_blank"
        rel="noopener noreferrer"
        {...stylex.props(styles.channelPill)}
        aria-label={
          price
            ? `${label} — ${price} (opens in new tab)`
            : `${label} (opens in new tab)`
        }
      >
        {inner}
      </AriaLink>
    );
  }
  return (
    <span
      {...stylex.props(styles.channelPill, styles.channelPillStatic)}
      aria-label={price ? `${label} — ${price}` : label}
    >
      {inner}
    </span>
  );
}

/** Channel-less plan: render the plan name + price as its own pill. */
function FundingPlanPill({ plan }: { plan: FundingPlanView }) {
  const price = formatFundingAmount(plan.amount, plan.currency, plan.frequency);
  return (
    <span
      {...stylex.props(styles.channelPill, styles.channelPillStatic)}
      aria-label={price ? `${plan.name} — ${price}` : plan.name}
    >
      <span>{plan.name}</span>
      {price ? (
        <span {...stylex.props(styles.channelPillPrice)}>{price}</span>
      ) : null}
    </span>
  );
}

/**
 * "Depends on" row — avatar + handle/displayName + arrow. Clicks open the upstream
 * entity's at.fund profile so people land on the steward's funding page (with all
 * their channels/plans) rather than their generic Bluesky profile. Prefers handle
 * when resolved so the URL is human-readable; falls back to the DID otherwise.
 */
function FundingDependencyRow({
  dependency,
}: {
  dependency: FundingDependencyView;
}) {
  const name =
    dependency.label?.trim() ||
    dependency.displayName?.trim() ||
    dependency.handle?.trim() ||
    dependency.subjectDid;
  const handle = dependency.handle?.trim();
  const href = `https://www.at.fund/${handle || dependency.subjectDid}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name} on at.fund (opens in new tab)`}
      {...stylex.props(styles.dependsRow)}
    >
      <Avatar
        size="md"
        alt={name}
        fallback={getInitials(name)}
        src={dependency.avatarUrl ?? undefined}
      />
      <Flex direction="column" gap="lg" style={styles.grow}>
        <Text size="sm" weight="semibold" style={styles.dependsName}>
          {name}
        </Text>
        <Text size="xs" variant="secondary">
          @{handle}
        </Text>
      </Flex>
    </a>
  );
}
