import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { HeaderLayout } from "../design-system/header-layout";
import { Suspense } from "react";

export const Route = createFileRoute("/_header-layout")({
  component: HeaderLayoutRoute,
});

function HeaderLayoutRoute() {
  return (
    <HeaderLayout.Root>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>

      <HeaderLayout.Page>
        <Suspense>
          <Outlet />
        </Suspense>
      </HeaderLayout.Page>

      <HeaderLayout.Footer>
        <SiteFooter />
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}
