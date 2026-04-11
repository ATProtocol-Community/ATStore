import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createLink, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import Cookies from "universal-cookie";

import { AvatarButton } from "../design-system/avatar";
import { Button } from "../design-system/button";
import { Menu, MenuItem, MenuSeparator } from "../design-system/menu";
import { NavbarAction } from "../design-system/navbar";
import {
  ATPROTO_DID_COOKIE,
  AUTH_SESSION_TOKEN_COOKIE,
} from "#/integrations/auth/constants";
import { user } from "#/integrations/tanstack-query/api-user.functions";

const ButtonLink = createLink(Button);

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

      const cookies = new Cookies();
      cookies.remove(ATPROTO_DID_COOKIE, { path: "/" });
      cookies.remove(AUTH_SESSION_TOKEN_COOKIE, { path: "/" });

      queryClient.setQueryData(user.getSessionQueryOptions.queryKey, null);
      await queryClient.resetQueries();
      await navigate({ to: "/" });
    },
  });

  if (session?.user) {
    const initial = session.user.name?.charAt(0).toUpperCase() ?? "U";
    return (
      <NavbarAction alwaysVisible>
        <Menu
          size="lg"
          trigger={
            <AvatarButton
              size="md"
              src={session.user.image ?? undefined}
              fallback={initial}
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
                handle != null && handle !== ""
                  ? handle.replace(/^@+/, "")
                  : did;
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
              void navigate({ to: "/products/create" });
            }}
          >
            Submit a product
          </MenuItem>
          <MenuSeparator />
          <MenuItem onPress={() => logoutMutation.mutate()} suffix={<LogOut />}>
            Log out
          </MenuItem>
        </Menu>
      </NavbarAction>
    );
  }

  return (
    <NavbarAction alwaysVisible>
      <ButtonLink to="/login" variant="secondary" size="md">
        Log in
      </ButtonLink>
    </NavbarAction>
  );
}
