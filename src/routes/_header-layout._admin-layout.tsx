import {
  createFileRoute,
  createLink,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import {
  Sidebar,
  SidebarItem,
  SidebarSection,
  type SidebarItemProps,
} from "../design-system/sidebar";
import { SidebarLayout } from "../design-system/sidebar-layout";
import { adminApi } from "../integrations/tanstack-query/api-admin.functions";
import { user as userApi } from "../integrations/tanstack-query/api-user.functions";

export const Route = createFileRoute("/_header-layout/_admin-layout")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      userApi.getSessionQueryOptions,
    );
    if (!session?.user) {
      throw redirect({
        to: "/login",
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

const SidebarLink = createLink(SidebarItemIgnoreStyleAndClassName);

function RouteComponent() {
  return (
    <SidebarLayout.Root>
      <SidebarLayout.NavigationSidebar>
        <Sidebar>
          <SidebarSection title="Admin">
            <SidebarLink
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{ isActive: true }}
            >
              Overview
            </SidebarLink>
            <SidebarLink
              to="/admin/unverified-listings"
              activeProps={{ isActive: true }}
            >
              Unverified Listings
            </SidebarLink>
            <SidebarLink
              to="/admin/pending-claims"
              activeProps={{ isActive: true }}
            >
              Pending Claims
            </SidebarLink>
            <SidebarLink
              to="/admin/listing-product-accounts"
              activeProps={{ isActive: true }}
            >
              Product Account Associations
            </SidebarLink>
            <SidebarLink
              to="/admin/home-page-hero"
              activeProps={{ isActive: true }}
            >
              Home Page Hero
            </SidebarLink>
            <SidebarLink
              to="/admin/managed-listings"
              activeProps={{ isActive: true }}
            >
              Managed Listings
            </SidebarLink>
          </SidebarSection>
        </Sidebar>
      </SidebarLayout.NavigationSidebar>
      <SidebarLayout.Page>
        <Outlet />
      </SidebarLayout.Page>
    </SidebarLayout.Root>
  );
}
