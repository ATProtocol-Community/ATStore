import type { AnyRouter } from "@tanstack/react-router";

import { prefersReducedMotion } from "./motion";

type ViewTransitionOptions = Extract<
  NonNullable<AnyRouter["options"]["defaultViewTransition"]>,
  object
>;

/**
 * Page transitions (View Transitions API, driven by the router).
 *
 * Every page change crossfades with a small lift; the header stays put and
 * the nav underline slides between sections. On a listing page the icon and
 * hero settle into place where they are (see styles.css) rather than flying
 * in from the card that was clicked. Search-param-only changes (filters,
 * sort, typing in search) don't transition, so results stay instant.
 *
 * With reduced motion on, no view transition is started at all: navigation
 * swaps the page instantly, exactly as it would without the API.
 */

/** Names for the listing page's icon and hero (one of each per page). */
export const LISTING_ICON_TRANSITION = "listing-icon";
export const LISTING_HERO_TRANSITION = "listing-hero";

const LISTING_PATH = /^\/products\/[^/]+\/?$/;

export const viewTransitionOptions: ViewTransitionOptions = {
  types: ({ pathChanged, toLocation }) => {
    if (!pathChanged || prefersReducedMotion()) return false;
    return LISTING_PATH.test(toLocation.pathname) ? ["to-listing"] : ["page"];
  },
};
