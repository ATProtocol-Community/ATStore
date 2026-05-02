import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLink, useNavigate } from "@tanstack/react-router";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { LogOut, Shield } from "lucide-react";

import { AvatarButton } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Flex } from "../design-system/flex";
import { Menu, MenuItem, MenuSeparator } from "../design-system/menu";
import { size } from "../design-system/theme/semantic-spacing.stylex";
import { ThemeSubMenu } from "./ThemeMenu";

const ButtonLink = createLink(Button);

const styles = stylex.create({
  avatar: {
    height: size["4xl"],
    width: size["4xl"],
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
          <AvatarButton
            size="md"
            src={session.user.image ?? undefined}
            fallback={initial}
            avatarStyle={styles.avatar}
          />
        }
        placement="bottom end"
      >
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
