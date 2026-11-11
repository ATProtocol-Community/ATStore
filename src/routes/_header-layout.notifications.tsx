import type { ComponentProps, ReactNode } from "react";

import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  createFileRoute,
  createLink,
  redirect,
} from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  Bell,
  Check,
  CircleCheck,
} from "lucide-react";

import type { ProductNotification } from "../integrations/tanstack-query/api-notification.functions";

import { PersonAvatar } from "../components/shelf/account/PersonAvatar";
import { ListingIcon } from "../components/shelf/ListingIcon";
import { PageHero } from "../components/shelf/Section";
import { Button } from "../design-system/button";
import { StarRating } from "../design-system/star-rating";
import { animationDuration } from "../design-system/theme/animations.stylex";
import {
  criticalColor,
  successColor,
  uiColor,
} from "../design-system/theme/color.stylex";
import { breakpoints } from "../design-system/theme/media-queries.stylex";
import {
  fontFamily,
  fontWeight,
} from "../design-system/theme/typography.stylex";
import { notificationApi } from "../integrations/tanstack-query/api-notification.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { useNotificationReadState } from "../lib/notification-read-state";

const DAY_MS = 86_400_000;

const styles = stylex.create({
  page: {
    marginInline: "auto",
    fontFamily: fontFamily.sans,
    maxWidth: 820,
    paddingBottom: { default: 56, [breakpoints.md]: 88 },
  },
  countBadge: {
    borderRadius: 999,
    paddingInline: 10,
    placeItems: "center",
    backgroundColor: uiColor.text2,
    color: uiColor.bg,
    display: "inline-grid",
    fontSize: { default: 14, [breakpoints.md]: 16 },
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    letterSpacing: 0,
    lineHeight: 1,
    verticalAlign: "middle",
    height: { default: 28, [breakpoints.md]: 34 },
    marginLeft: 10,
    minWidth: { default: 28, [breakpoints.md]: 34 },
  },
  group: {
    color: uiColor.text1,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 28,
  },
  firstGroup: {
    marginTop: 0,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
  },
  note: {
    borderRadius: 14,
    marginInline: -16,
    paddingBlock: 18,
    paddingInline: 16,
    alignItems: "start",
    backgroundColor: {
      default: "transparent",
      ":hover": uiColor.component1,
    },
    columnGap: 14,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    position: "relative",
    transitionDuration: animationDuration.default,
    transitionProperty: "background-color",
    "::before": {
      insetInline: 16,
      backgroundColor: uiColor.border1,
      content: "''",
      position: "absolute",
      height: 1,
      top: 0,
    },
  },
  firstNote: {
    "::before": {
      display: "none",
    },
  },
  unreadDot: {
    borderRadius: "50%",
    backgroundColor: uiColor.text2,
    position: "absolute",
    height: 6,
    left: 3,
    top: 35,
    width: 6,
  },
  lead: {
    borderRadius: "50%",
    textDecoration: "none",
    display: "block",
    lineHeight: 0,
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: 2,
    position: "relative",
  },
  systemIcon: {
    borderRadius: "50%",
    placeItems: "center",
    display: "grid",
    height: 40,
    width: 40,
  },
  systemSuccess: {
    backgroundColor: successColor.component1,
    color: successColor.text1,
  },
  systemCritical: {
    backgroundColor: criticalColor.component1,
    color: criticalColor.text1,
  },
  systemMuted: {
    backgroundColor: uiColor.component2,
    color: uiColor.text1,
  },
  body: {
    minWidth: 0,
  },
  title: {
    color: uiColor.text2,
    fontSize: 15,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  strong: {
    textDecoration: {
      default: "none",
      ":hover": "underline",
    },
    color: uiColor.text2,
    fontWeight: fontWeight.semibold,
  },
  meta: {
    alignItems: "center",
    color: uiColor.text1,
    columnGap: 10,
    display: "flex",
    fontSize: 13,
    rowGap: 10,
    marginTop: 4,
  },
  excerpt: {
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
    color: uiColor.text2,
    display: "-webkit-box",
    fontSize: 14,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
    marginBottom: 0,
    marginTop: 8,
  },
  actions: {
    columnGap: 16,
    display: "flex",
    flexWrap: "wrap",
    rowGap: 4,
    marginTop: 8,
  },
  action: {
    textDecoration: "none",
    alignItems: "center",
    color: {
      default: uiColor.text1,
      ":hover": uiColor.text2,
    },
    columnGap: 4,
    display: "inline-flex",
    fontSize: 13,
    fontWeight: fontWeight.medium,
    transitionDuration: animationDuration.default,
    transitionProperty: "color",
  },
  primaryAction: {
    color: uiColor.text2,
  },
  listingIcon: {
    display: { default: "none", [breakpoints.sm]: "inline-grid" },
  },
  empty: {
    borderColor: uiColor.border2,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingBlock: 64,
    paddingInline: 24,
    textAlign: "center",
  },
  emptyIcon: {
    borderRadius: "50%",
    marginInline: "auto",
    placeItems: "center",
    backgroundColor: uiColor.component1,
    color: uiColor.text1,
    display: "grid",
    height: 48,
    marginBottom: 16,
    width: 48,
  },
  emptyTitle: {
    margin: 0,
    color: uiColor.text2,
    fontFamily: fontFamily.title,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: "-0.03em",
  },
  emptyBody: {
    marginInline: "auto",
    color: uiColor.text1,
    lineHeight: 1.5,
    marginBottom: 0,
    marginTop: 6,
    maxWidth: "32em",
  },
});

function formatRelativeTime(isoDate: string) {
  const diffMs = Date.now() - Date.parse(isoDate);
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "just now";
  }
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (diffMs < minuteMs) {
    return "just now";
  }
  if (diffMs < hourMs) {
    const mins = Math.floor(diffMs / minuteMs);
    return `${mins}m ago`;
  }
  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffMs / dayMs);
  return `${days}d ago`;
}

const GROUPS: Array<{ label: string; test: (ageDays: number) => boolean }> = [
  { label: "This week", test: (age) => age < 7 },
  { label: "This month", test: (age) => age >= 7 && age < 31 },
  { label: "Earlier", test: (age) => !(age < 31) },
];

export const Route = createFileRoute("/_header-layout/notifications")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/login",
        search: { redirect: "/notifications" },
      });
    }
    await Promise.all([
      context.queryClient.ensureQueryData(
        notificationApi.getProductNotificationsQueryOptions({ limit: 50 }),
      ),
      context.queryClient.ensureQueryData(
        notificationApi.getNotificationsReadAtQueryOptions(),
      ),
    ]);
    return {};
  },
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications | at-store" }] }),
});

function NotificationsPage() {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: notifications = [] } = useQuery(
    notificationApi.getProductNotificationsQueryOptions({ limit: 50 }),
  );
  const { unreadCount, lastReadAt, markAllRead } = useNotificationReadState(
    session?.user?.did ?? null,
    notifications,
  );
  const lastReadMs = lastReadAt == null ? Number.NaN : Date.parse(lastReadAt);
  const isUnread = (item: ProductNotification) =>
    unreadCount > 0 &&
    (!Number.isFinite(lastReadMs) || Date.parse(item.createdAt) > lastReadMs);

  const now = Date.now();
  const groups = GROUPS.map((group) => ({
    label: group.label,
    items: notifications.filter((item) =>
      group.test((now - Date.parse(item.createdAt)) / DAY_MS),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <div {...stylex.props(styles.page)}>
      <PageHero
        title={
          <>
            Notifications
            {unreadCount > 0 ? (
              <span
                {...stylex.props(styles.countBadge)}
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount}
              </span>
            ) : null}
          </>
        }
        aside={
          <Button
            size="md"
            variant="secondary"
            onPress={markAllRead}
            isDisabled={notifications.length === 0 || unreadCount === 0}
          >
            <Check size={15} aria-hidden />
            Mark all read
          </Button>
        }
      />

      {notifications.length === 0 ? (
        <div {...stylex.props(styles.empty)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <Bell size={20} aria-hidden />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>No notifications yet</h2>
          <p {...stylex.props(styles.emptyBody)}>
            Likes, reviews, review replies, directory moderation decisions, and
            listing claim outcomes will show up here.
          </p>
        </div>
      ) : (
        groups.map((group, groupIndex) => (
          <section key={group.label} aria-label={group.label}>
            <h2
              {...stylex.props(
                styles.group,
                groupIndex === 0 && styles.firstGroup,
              )}
            >
              {group.label}
            </h2>
            <ul {...stylex.props(styles.list)}>
              {group.items.map((item, index) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  first={index === 0}
                  unread={isUnread(item)}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function NotificationRow({
  item,
  first,
  unread,
}: {
  item: ProductNotification;
  first: boolean;
  unread: boolean;
}) {
  const isLike = item.type === "listing_liked";
  const isListingVerified = item.type === "listing_verified";
  const isListingRejected = item.type === "listing_rejected";
  const isClaimApproved = item.type === "claim_approved";
  const isClaimRejected = item.type === "claim_rejected";
  const isReplyOwner = item.type === "listing_review_reply_owner";
  const isReplyReviewer = item.type === "listing_review_reply_reviewer";
  const isReplyDual = item.type === "listing_review_reply_dual";
  const isReplyThread = isReplyOwner || isReplyReviewer || isReplyDual;
  const isSystem =
    isListingVerified ||
    isListingRejected ||
    isClaimApproved ||
    isClaimRejected;
  const isReview = !isReplyThread && !isLike && !isSystem;

  const actorName =
    item.actorHandle || item.actorDisplayName || item.actorDid || "Someone";
  const actorProfileId = item.actorHandle?.replace(/^@+/, "") || item.actorDid;
  const productId = getDirectoryListingSlug({
    slug: item.listingSlug,
    name: item.listingName,
  });

  const reviewThreadDeepLinkSearch =
    isReplyThread &&
    item.reviewThreadReviewId != null &&
    item.reviewThreadReplyId != null
      ? {
          review: item.reviewThreadReviewId,
          reply: item.reviewThreadReplyId,
        }
      : null;

  const actor = actorProfileId ? (
    <RouterLink
      to="/profile/$actor"
      params={{ actor: actorProfileId }}
      {...stylex.props(styles.strong)}
    >
      {item.actorDisplayName || item.actorHandle || "Someone"}
    </RouterLink>
  ) : (
    <b {...stylex.props(styles.strong)}>Someone</b>
  );
  const listing = (
    <RouterLink
      to="/products/$productId"
      params={{ productId }}
      {...stylex.props(styles.strong)}
    >
      {item.listingName}
    </RouterLink>
  );

  let title: ReactNode;
  if (isListingVerified) {
    title = <>{listing} was approved</>;
  } else if (isListingRejected) {
    title = <>{listing} needs changes</>;
  } else if (isClaimApproved) {
    title = <>Your claim for {listing} was approved</>;
  } else if (isClaimRejected) {
    title = <>Your claim for {listing} was declined</>;
  } else if (isReplyDual) {
    title = (
      <>
        {actor} replied on your listing review thread for {listing}
      </>
    );
  } else if (isReplyOwner) {
    title = (
      <>
        {actor} replied on a review for {listing}
      </>
    );
  } else if (isReplyReviewer) {
    title = (
      <>
        {actor} replied to your review on {listing}
      </>
    );
  } else if (isLike) {
    title = (
      <>
        {actor} liked {listing}
      </>
    );
  } else {
    title = (
      <>
        {actor} reviewed {listing}
      </>
    );
  }

  let excerpt: ReactNode = null;
  if (isClaimApproved) {
    excerpt = "Go to Claim listing to move this product to your PDS.";
  } else if (isListingVerified) {
    excerpt = "Your listing is visible in the public directory.";
  } else if (isListingRejected && item.reviewText) {
    excerpt = (
      <>
        <strong>Note:</strong> {item.reviewText}
      </>
    );
  } else if (isReplyThread && item.reviewText) {
    excerpt = `“${item.reviewText}”`;
  } else if (isReview && item.reviewText) {
    excerpt = item.reviewText;
  }

  let lead: ReactNode;
  if (isSystem) {
    lead = (
      <span
        aria-hidden
        {...stylex.props(
          styles.systemIcon,
          isListingVerified || isClaimApproved
            ? styles.systemSuccess
            : isListingRejected
              ? styles.systemCritical
              : styles.systemMuted,
        )}
      >
        {isListingVerified || isClaimApproved ? (
          <CircleCheck size={20} />
        ) : isListingRejected ? (
          <AlertCircle size={20} />
        ) : (
          <Ban size={20} />
        )}
      </span>
    );
  } else {
    const avatar = (
      <PersonAvatar name={actorName} src={item.actorAvatarUrl} size={40} />
    );
    lead = actorProfileId ? (
      <RouterLink
        to="/profile/$actor"
        params={{ actor: actorProfileId }}
        aria-label={`${item.actorDisplayName || item.actorHandle || "Someone"}'s profile`}
        {...stylex.props(styles.lead)}
      >
        {avatar}
      </RouterLink>
    ) : (
      <span {...stylex.props(styles.lead)}>{avatar}</span>
    );
  }

  let actions: ReactNode;
  if (isClaimApproved) {
    actions = (
      <ActionLink primary to="/product/claim" hash="instant-claim">
        Claim your listing
      </ActionLink>
    );
  } else if (isClaimRejected) {
    actions = (
      <ActionLink primary to="/product/claim">
        View claim page
      </ActionLink>
    );
  } else if (reviewThreadDeepLinkSearch) {
    actions = (
      <>
        <ActionLink
          primary
          to="/products/$productId/reviews"
          params={{ productId }}
          search={reviewThreadDeepLinkSearch}
        >
          View thread
        </ActionLink>
        <ActionLink to="/products/$productId" params={{ productId }}>
          Open product
        </ActionLink>
      </>
    );
  } else if (isListingVerified || isListingRejected) {
    actions = (
      <>
        <ActionLink primary to="/products/$productId" params={{ productId }}>
          Open product
        </ActionLink>
        <ActionLink to="/products/manage">Manage listings</ActionLink>
      </>
    );
  } else {
    actions = (
      <ActionLink primary to="/products/$productId" params={{ productId }}>
        Open product
      </ActionLink>
    );
  }

  return (
    <li {...stylex.props(styles.note, first && styles.firstNote)}>
      {unread ? (
        <span
          role="img"
          aria-label="Unread"
          {...stylex.props(styles.unreadDot)}
        />
      ) : null}
      {lead}
      <div {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.title)}>{title}</div>
        <div {...stylex.props(styles.meta)}>
          {isReview && item.reviewRating != null ? (
            <StarRating
              rating={item.reviewRating}
              size={12}
              showReviewCount={false}
              aria-label={`${item.reviewRating} out of 5 stars`}
            />
          ) : null}
          <span>{formatRelativeTime(item.createdAt)}</span>
        </div>
        {excerpt ? <p {...stylex.props(styles.excerpt)}>{excerpt}</p> : null}
        <div {...stylex.props(styles.actions)}>{actions}</div>
      </div>
      <ListingIcon
        name={item.listingName}
        src={item.listingIconUrl}
        size={36}
        style={styles.listingIcon}
      />
    </li>
  );
}

function ActionAnchor({
  children,
  primary = false,
  ...props
}: ComponentProps<"a"> & { primary?: boolean }) {
  return (
    <a
      {...props}
      {...stylex.props(styles.action, primary && styles.primaryAction)}
    >
      {children}
      {primary ? <ArrowRight size={13} aria-hidden /> : null}
    </a>
  );
}

const ActionLink = createLink(ActionAnchor);
