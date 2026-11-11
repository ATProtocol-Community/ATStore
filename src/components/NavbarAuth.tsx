import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLink, useNavigate } from "@tanstack/react-router";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import {
  BadgeCheck,
  LayoutGrid,
  LogOut,
  Shield,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import { AvatarButton } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { Menu, MenuItem, MenuSeparator } from "../design-system/menu";
import { uiColor } from "../design-system/theme/color.stylex";
import { fontWeight } from "../design-system/theme/typography.stylex";
import { LanguageDrawer, LanguageSubMenu } from "./LanguageSwitcher";
import { PersonAvatar } from "./shelf/account/PersonAvatar";
import { ThemeSubMenu } from "./ThemeMenu";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  trigger: {
    borderRadius: "50%",
    outlineColor: uiColor.text2,
    outlineOffset: 2,
    outlineStyle: {
      default: "none",
      ":is([data-focus-visible])": "solid",
    },
    outlineWidth: 2,
  },
  avatar: {
    borderRadius: "50%",
    boxShadow: `0 0 0 1px ${uiColor.border1}`,
    height: 36,
    width: 36,
  },
  header: {
    alignItems: "center",
    columnGap: 10,
    display: "flex",
    rowGap: 10,
    maxWidth: 240,
    paddingBottom: 6,
    paddingTop: 4,
  },
  identity: {
    minWidth: 0,
  },
  name: {
    overflow: "hidden",
    color: uiColor.text2,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  handle: {
    overflow: "hidden",
    color: uiColor.text1,
    fontSize: 12,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

export function NavbarAuth() {
  const { data: session } = useQuery(user.getSessionQueryOptions);
  const { data: userProfile } = useQuery({
    ...user.getUserProfileQueryOptions,
    enabled: session?.user != null,
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [langDrawerOpen, setLangDrawerOpen] = useState(false);

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
    const handle = userProfile?.blueskyHandle?.trim().replace(/^@+/, "");
    const displayName = session.user.name?.trim() || handle || "Your account";
    return (
      <>
        <Menu
          size="md"
          trigger={
            <AvatarButton
              size="md"
              aria-label="Account menu"
              src={session.user.image ?? undefined}
              fallback={initial}
              style={styles.trigger}
              avatarStyle={styles.avatar}
            />
          }
          header={
            <div {...stylex.props(styles.header)}>
              <PersonAvatar
                name={displayName}
                src={session.user.image}
                size={36}
              />
              <div {...stylex.props(styles.identity)}>
                <div {...stylex.props(styles.name)}>{displayName}</div>
                {handle ? (
                  <div {...stylex.props(styles.handle)}>@{handle}</div>
                ) : null}
              </div>
            </div>
          }
          placement="bottom end"
        >
          <MenuItem
            prefix={<UserRound size={16} aria-hidden />}
            onPress={() => {
              const did = session.user.did;
              if (did == null || did === "") {
                return;
              }
              const actor = handle != null && handle !== "" ? handle : did;
              void navigate({
                to: "/profile/$actor",
                params: { actor },
              });
            }}
          >
            Profile
          </MenuItem>
          <MenuItem
            prefix={<LayoutGrid size={16} aria-hidden />}
            onPress={() => {
              void navigate({ to: "/products/manage" });
            }}
          >
            Manage listings
          </MenuItem>
          <MenuItem
            prefix={<BadgeCheck size={16} aria-hidden />}
            onPress={() => {
              void navigate({ to: "/product/claim" });
            }}
          >
            Claim a listing
          </MenuItem>
          {session.user.isAdmin ? (
            <MenuItem
              prefix={<Shield size={16} aria-hidden />}
              onPress={() => {
                void navigate({ to: "/admin" });
              }}
            >
              Admin
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <LanguageSubMenu onOpenDrawer={() => setLangDrawerOpen(true)} />
          <ThemeSubMenu />
          <MenuSeparator />
          <MenuItem
            prefix={<LogOut size={16} aria-hidden />}
            onPress={() => logoutMutation.mutate()}
          >
            Log out
          </MenuItem>
        </Menu>
        <LanguageDrawer
          isOpen={langDrawerOpen}
          onOpenChange={setLangDrawerOpen}
        />
      </>
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
