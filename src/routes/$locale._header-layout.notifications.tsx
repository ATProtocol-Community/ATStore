import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createLocaleLink } from "../components/LocaleLink";
import { Ban, Bell, Check, CircleCheck, Heart, Star } from "lucide-react";

import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { Page } from "../design-system/page";
import {
  criticalColor,
  primaryColor,
  uiColor,
} from "../design-system/theme/color.stylex";
import { radius } from "../design-system/theme/radius.stylex";
import {
  gap,
  horizontalSpace,
  size,
  verticalSpace,
} from "../design-system/theme/semantic-spacing.stylex";
import { Text } from "../design-system/typography/text";
import { notificationApi } from "../integrations/tanstack-query/api-notification.functions";
import { user } from "../integrations/tanstack-query/api-user.functions";
import { getDirectoryListingSlug } from "../lib/directory-listing-slugs";
import { useNotificationReadState } from "../lib/notification-read-state";

const ButtonLink = createLocaleLink(Button);

const styles = stylex.create({
  notificationsList: {
    display: "flex",
    flexDirection: "column",
    gap: gap.lg,
  },
  notificationCard: {
    alignItems: "flex-start",
    backgroundColor: uiColor.bg,
    borderColor: uiColor.border1,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: 1,
    cornerShape: "squircle",
    display: "flex",
    gap: gap["2xl"],
    paddingTop: verticalSpace["3xl"],
    paddingBottom: verticalSpace["3xl"],
    paddingLeft: horizontalSpace["3xl"],
    paddingRight: horizontalSpace["3xl"],
  },
  icon: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    display: "flex",
    flexShrink: 0,
    height: size["5xl"],
    justifyContent: "center",
    width: size["5xl"],
  },
  likedIcon: {
    backgroundColor: primaryColor.component1,
    color: primaryColor.text1,
    borderColor: primaryColor.border1,
  },
  reviewedIcon: {
    backgroundColor: criticalColor.component1,
    color: criticalColor.text1,
    borderColor: criticalColor.border1,
  },
  claimApprovedIcon: {
    backgroundColor: primaryColor.component1,
    color: primaryColor.text1,
    borderColor: primaryColor.border1,
  },
  claimRejectedIcon: {
    backgroundColor: uiColor.bgSubtle,
    color: uiColor.text1,
    borderColor: uiColor.border1,
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    width: "100%",
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardBody: {
    marginTop: verticalSpace.md,
  },
  cardActions: {
    marginTop: verticalSpace.lg,
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

export const Route = createFileRoute("/$locale/_header-layout/notifications")({
  loader: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(
      user.getSessionQueryOptions,
    );
    if (!session?.user?.did) {
      throw redirect({
        to: "/$locale/login",
        search: { redirect: "/notifications" },
      });
    }
    await context.queryClient.ensureQueryData(
      notificationApi.getProductNotificationsQueryOptions({ limit: 50 }),
    );
    return {};
  },
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Notifications | at-store" }] }),
});

function NotificationsPage() {
  const navigate = useNavigate();
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: notifications = [] } = useQuery(
    notificationApi.getProductNotificationsQueryOptions({ limit: 50 }),
  );
  const { unreadCount, markAllRead } = useNotificationReadState(
    session?.user?.did ?? null,
    notifications,
  );

  return (
    <Page.Root variant="small">
      <Page.Header>
        <Page.Title>
          <Flex align="center" gap="md">
            <Bell size={22} />
            <Flex align="center" gap="md">
              Notifications
              {unreadCount > 0 && (
                <Badge size="sm" variant="primary">
                  {unreadCount}
                </Badge>
              )}
            </Flex>
          </Flex>
        </Page.Title>
        <Page.Actions>
          <Button
            size="md"
            variant="secondary"
            onPress={markAllRead}
            isDisabled={notifications.length === 0 || unreadCount === 0}
          >
            <Flex align="center" gap="sm">
              <Check size={16} />
              Mark all read
            </Flex>
          </Button>
        </Page.Actions>
      </Page.Header>

      {notifications.length === 0 ? (
        <Text variant="secondary">
          No notifications yet. Likes, reviews, and listing claim decisions will
          show up here.
        </Text>
      ) : (
        <div {...stylex.props(styles.notificationsList)}>
          {notifications.map((item) => {
            const isLike = item.type === "listing_liked";
            const isClaimApproved = item.type === "claim_approved";
            const isClaimRejected = item.type === "claim_rejected";
            const actor =
              item.actorHandle || item.actorDisplayName || "Someone";
            const productId = getDirectoryListingSlug({
              slug: item.listingSlug,
              name: item.listingName,
            });
            return (
              <div key={item.id} {...stylex.props(styles.notificationCard)}>
                <div
                  {...stylex.props(
                    styles.icon,
                    isLike
                      ? styles.likedIcon
                      : isClaimApproved
                        ? styles.claimApprovedIcon
                        : isClaimRejected
                          ? styles.claimRejectedIcon
                          : styles.reviewedIcon,
                  )}
                >
                  {isLike ? (
                    <Heart size={22} />
                  ) : isClaimApproved ? (
                    <CircleCheck size={22} />
                  ) : isClaimRejected ? (
                    <Ban size={22} />
                  ) : (
                    <Star size={22} />
                  )}
                </div>
                <Flex direction="column" gap="xl" style={styles.contentColumn}>
                  <Flex
                    align="start"
                    justify="between"
                    gap="xl"
                    style={styles.headerRow}
                  >
                    <Text size="xl" weight="semibold">
                      {isClaimApproved
                        ? `Your claim for ${item.listingName} was approved`
                        : isClaimRejected
                          ? `Your claim for ${item.listingName} was declined`
                          : isLike
                            ? `${actor} liked ${item.listingName}`
                            : `${actor} reviewed ${item.listingName}`}
                    </Text>
                    <Text size="sm" variant="secondary">
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </Flex>
                  {isClaimApproved ? (
                    <Text size="sm" variant="secondary" style={styles.cardBody}>
                      Go to Claim listing to move this product to your PDS.
                    </Text>
                  ) : null}
                  {!isLike &&
                  !isClaimApproved &&
                  !isClaimRejected &&
                  item.reviewRating != null ? (
                    <Text size="sm" variant="secondary" style={styles.cardBody}>
                      {`${item.reviewRating} star${item.reviewRating === 1 ? "" : "s"}${
                        item.reviewText ? ` - ${item.reviewText}` : ""
                      }`}
                    </Text>
                  ) : null}
                  <div {...stylex.props(styles.cardActions)}>
                    {isClaimApproved ? (
                      <Button
                        size="sm"
                        onPress={() =>
                          void navigate({
                            to: "/$locale/product/claim",
                            hash: "instant-claim",
                          })
                        }
                      >
                        Claim your listing
                      </Button>
                    ) : isClaimRejected ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() =>
                          void navigate({ to: "/$locale/product/claim" })
                        }
                      >
                        View claim page
                      </Button>
                    ) : (
                      <ButtonLink
                        to="/$locale/products/$productId"
                        params={{ productId }}
                        size="sm"
                      >
                        Open product
                      </ButtonLink>
                    )}
                  </div>
                </Flex>
              </div>
            );
          })}
        </div>
      )}
    </Page.Root>
  );
}
