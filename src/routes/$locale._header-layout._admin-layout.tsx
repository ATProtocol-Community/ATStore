import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { createLocaleLink } from "../components/LocaleLink";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  Sidebar,
  SidebarItem,
  SidebarSection,
  type SidebarItemProps,
} from "../design-system/sidebar";
import { SidebarLayout } from "../design-system/sidebar-layout";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { user as userApi } from "../integrations/tanstack-query/api-user.functions";
import { isSuperAdminDid } from "../lib/super-admin";

export const Route = createFileRoute("/$locale/_header-layout/_admin-layout")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      userApi.getSessionQueryOptions,
    );
    if (!session?.user) {
      throw redirect({
        to: "/$locale/login",
        search: { redirect: location.pathname },
      });
    }
    if (!session.user.isAdmin) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      adminApi.getAdminDashboardQueryOptions,
    );
  },
  component: RouteComponent,
});

function SidebarItemIgnoreStyleAndClassName({
  style,
  className,
  ...props
}: SidebarItemProps) {
  return <SidebarItem {...props} />;
}

const SidebarLink = createLocaleLink(SidebarItemIgnoreStyleAndClassName);

function RouteComponent() {
  const { data: session } = useSuspenseQuery(userApi.getSessionQueryOptions);
  const isSuperAdmin = isSuperAdminDid(session?.user?.did ?? null);

  return (
    <SidebarLayout.Root>
      <SidebarLayout.NavigationSidebar>
        <Sidebar>
          <SidebarSection title="Admin">
            <SidebarLink
              to="/$locale/admin"
              activeOptions={{ exact: true }}
              activeProps={{ isActive: true }}
            >
              Overview
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/unverified-listings"
              activeProps={{ isActive: true }}
            >
              Unverified Listings
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/pending-claims"
              activeProps={{ isActive: true }}
            >
              Pending Claims
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/recently-claimed"
              activeProps={{ isActive: true }}
            >
              Recently Claimed
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/reviews"
              activeProps={{ isActive: true }}
            >
              Reviews
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/listing-product-accounts"
              activeProps={{ isActive: true }}
            >
              Product Account Associations
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/home-page-hero"
              activeProps={{ isActive: true }}
            >
              Home Page Hero
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/managed-listings"
              activeProps={{ isActive: true }}
            >
              Managed Listings
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/add-listing"
              activeProps={{ isActive: true }}
            >
              Add Listing
            </SidebarLink>
            <SidebarLink
              to="/$locale/admin/hero-art"
              activeProps={{ isActive: true }}
            >
              Hero Art
            </SidebarLink>
            {import.meta.env.DEV ? (
              <SidebarLink
                to="/$locale/admin/hero-candidates"
                activeProps={{ isActive: true }}
              >
                Hero Candidates (dev)
              </SidebarLink>
            ) : null}
          </SidebarSection>
          {isSuperAdmin ? (
            <SidebarSection title="Super admin">
              <SidebarLink
                to="/$locale/admin/admins"
                activeProps={{ isActive: true }}
              >
                Admins
              </SidebarLink>
            </SidebarSection>
          ) : null}
        </Sidebar>
      </SidebarLayout.NavigationSidebar>
      <SidebarLayout.Page>
        <Outlet />
      </SidebarLayout.Page>
    </SidebarLayout.Root>
  );
}
