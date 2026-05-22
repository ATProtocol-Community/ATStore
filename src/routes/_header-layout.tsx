import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { HeaderLayout } from "../design-system/header-layout";

export const Route = createFileRoute("/_header-layout")({
  component: HeaderLayoutRoute,
});

/** Shown only while a child route suspends; avoids a blank page shell. */
function HeaderLayoutOutletFallback() {
  return (
    <div aria-busy="true" aria-live="polite" style={{ minHeight: "40vh" }} />
  );
}

function HeaderLayoutRoute() {
  return (
    <HeaderLayout.Root>
      <HeaderLayout.Header>
        <SiteHeader />
      </HeaderLayout.Header>

      <HeaderLayout.Page>
        <Suspense fallback={<HeaderLayoutOutletFallback />}>
          <Outlet />
        </Suspense>
      </HeaderLayout.Page>

      <HeaderLayout.Footer>
        <SiteFooter />
      </HeaderLayout.Footer>
    </HeaderLayout.Root>
  );
}
