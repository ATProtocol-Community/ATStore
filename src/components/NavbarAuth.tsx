import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLink, useNavigate } from "@tanstack/react-router";
import { LogOut, Monitor, Moon, Shield, Sun } from "lucide-react";

import { AvatarButton } from "../design-system/avatar";
import { Badge } from "../design-system/badge";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { IconButton } from "../design-system/icon-button";
import { Menu, MenuItem, MenuSeparator } from "../design-system/menu";
import { NavbarAction } from "../design-system/navbar";
import { criticalColor } from "../design-system/theme/color.stylex";
import { size } from "../design-system/theme/semantic-spacing.stylex";
import { notificationApi } from "#/integrations/tanstack-query/api-notification.functions";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { useNotificationReadState } from "#/lib/notification-read-state";
import { useTheme } from "#/lib/ThemeContext";

import { ThemeMenu, ThemeSubMenu } from "./ThemeMenu";
import { breakpoints } from "../design-system/theme/media-queries.stylex";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  avatarTriggerWrapper: {
    display: "inline-flex",
    position: "relative",
  },
  unreadDot: {
    backgroundColor: criticalColor.solid1,
    borderColor: "white",
    borderRadius: "999px",
    borderStyle: "solid",
    borderWidth: 2,
    height: size.xs,
    pointerEvents: "none",
    position: "absolute",
    right: "-2px",
    top: "-2px",
    width: size.xs,
  },
  desktopAvatar: {
    display: {
      default: "none",
      [breakpoints.sm]: "flex",
    },
  },
  mobileAvatar: {
    display: {
      default: "flex",
      [breakpoints.sm]: "none",
    },
  },
});

export function NavbarAuth() {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: userProfile } = useQuery({
    ...user.getUserProfileQueryOptions,
    enabled: session?.user != null,
  });
  const { data: notifications } = useQuery({
    ...notificationApi.getProductNotificationsQueryOptions({ limit: 50 }),
    enabled: session?.user != null,
  });
  const { unreadCount } = useNotificationReadState(
    session?.user?.did ?? null,
    notifications ?? [],
  );
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await user.signOut();

      queryClient.setQueryData(user.getSessionQueryOptions.queryKey, null);
      await queryClient.resetQueries();
      await navigate({ to: "/" });
    },
  });

  if (session?.user) {
    const initial = session.user.name?.charAt(0).toUpperCase() ?? "U";
    return (
      <Menu
        size="lg"
        trigger={
          <div {...stylex.props(styles.avatarTriggerWrapper)}>
            <AvatarButton
              size="md"
              src={session.user.image ?? undefined}
              fallback={initial}
              label={session.user.name}
              style={styles.mobileAvatar}
            />
            <AvatarButton
              size="md"
              src={session.user.image ?? undefined}
              fallback={initial}
              style={styles.desktopAvatar}
            />
            {unreadCount > 0 && <span {...stylex.props(styles.unreadDot)} />}
          </div>
        }
        placement="bottom end"
      >
        <MenuItem
          onPress={() => {
            void navigate({ to: "/notifications" });
          }}
        >
          <Flex align="center" gap="md">
            Notifications
            {unreadCount > 0 && (
              <Badge size="sm" variant="primary">
                {unreadCount}
              </Badge>
            )}
          </Flex>
        </MenuItem>
        <MenuItem
          onPress={() => {
            const did = session.user.did;
            if (did == null || did === "") {
              return;
            }
            const handle = userProfile?.blueskyHandle?.trim();
            const actor =
              handle != null && handle !== "" ? handle.replace(/^@+/, "") : did;
            void navigate({
              to: "/profile/$actor",
              params: { actor },
            });
          }}
        >
          Profile
        </MenuItem>
        <MenuItem
          onPress={() => {
            void navigate({ to: "/products/manage" });
          }}
        >
          Manage listings
        </MenuItem>
        <MenuItem
          onPress={() => {
            void navigate({ to: "/product/claim" });
          }}
        >
          Claim a listing
        </MenuItem>
        {session.user.isAdmin ? (
          <MenuItem
            onPress={() => {
              void navigate({ to: "/admin" });
            }}
            suffix={<Shield />}
          >
            Admin
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <ThemeSubMenu />
        <MenuSeparator />
        <MenuItem onPress={() => logoutMutation.mutate()} suffix={<LogOut />}>
          Log out
        </MenuItem>
      </Menu>
    );
  }

  return (
    <Flex align="center" gap="sm">
      <ButtonLink to="/login" variant="secondary" size="lg">
        Log in
      </ButtonLink>
    </Flex>
  );
}

function GuestThemeMenu() {
  const { mode } = useTheme();
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  return (
    <ThemeMenu
      trigger={
        <IconButton variant="secondary" size="lg" aria-label="Change theme">
          <Icon />
        </IconButton>
      }
    />
  );
}
