import type { AnyRouter } from "@tanstack/react-router";

/** Set on <html> while a cover → hero morph is in flight (see styles.css). */
const HERO_MORPH_ATTR = "data-vt-hero";

type ViewTransitionOptions = Extract<
  NonNullable<AnyRouter["options"]["defaultViewTransition"]>,
  object
>;

/**
 * Page transitions (View Transitions API, driven by the router).
 *
 * - Every page change crossfades with a small lift; the header stays put and
 *   the nav underline slides between sections (see styles.css).
 * - Opening a listing morphs the icon (and cover image) you tapped into the
 *   listing page's header. Source elements are tagged at click time rather
 *   than statically, because the same listing can appear twice on one page
 *   (e.g. featured + popular on home) and duplicate transition names abort
 *   the whole transition.
 * - Search-param-only changes (filters, sort, typing in search) don't
 *   transition, so results stay instant.
 */

const LISTING_PATH = /^\/products\/([^/]+)\/?$/;

export const listingIconTransitionName = (slug: string) =>
  `listing-icon-${cssIdent(slug)}`;
export const listingHeroTransitionName = (slug: string) =>
  `listing-hero-${cssIdent(slug)}`;

/** view-transition-name must be a CSS identifier. */
function cssIdent(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9_-]/g, "-");
}

export const viewTransitionOptions: ViewTransitionOptions = {
  types: ({ pathChanged, toLocation }) => {
    if (!pathChanged) return false;
    return LISTING_PATH.test(toLocation.pathname) ? ["to-listing"] : ["page"];
  },
};

/**
 * Before a navigation to `/products/<slug>` starts, name the icon and cover
 * inside the clicked link so they morph into the listing header. Runs in the
 * capture phase so it happens before the router starts the transition.
 */
export function installListingMorphTagging(): () => void {
  if (typeof document === "undefined") return () => {};

  const tagged = new Set<HTMLElement>();
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    for (const el of tagged) el.style.removeProperty("view-transition-name");
    tagged.clear();
    document.documentElement.removeAttribute(HERO_MORPH_ATTR);
  };

  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = (event.target as Element | null)?.closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.origin !== location.origin) return;
    const match = LISTING_PATH.exec(anchor.pathname);
    if (!match?.[1]) return;
    // Already on this listing: nothing to morph into.
    if (location.pathname === anchor.pathname) return;

    clear();
    const slug = decodeURIComponent(match[1]);
    const icon = anchor.querySelector<HTMLElement>("[data-listing-icon]");
    const hero = anchor.matches("[data-listing-hero]")
      ? anchor
      : anchor.querySelector<HTMLElement>("[data-listing-hero]");
    if (icon) {
      icon.style.setProperty(
        "view-transition-name",
        listingIconTransitionName(slug),
      );
      tagged.add(icon);
    }
    if (hero) {
      hero.style.setProperty(
        "view-transition-name",
        listingHeroTransitionName(slug),
      );
      tagged.add(hero);
      // The listing page's hero only takes its transition name while this is
      // set, so it doesn't fade in on its own layer when nothing morphs into it.
      document.documentElement.setAttribute(HERO_MORPH_ATTR, "");
    }
    clearTimeout(clearTimer);
    // Long enough for the new page to load and be captured; short enough
    // that a quick Back doesn't reuse the names.
    clearTimer = setTimeout(clear, 1500);
  };

  document.addEventListener("click", onClick, true);
  return () => {
    document.removeEventListener("click", onClick, true);
    clearTimeout(clearTimer);
    clear();
  };
}
