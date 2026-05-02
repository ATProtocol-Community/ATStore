/**
 * Drop-in `<Link>` replacement that auto-injects the current `$locale` URL
 * param so callers don't have to repeat `params={{ locale, ... }}` at every
 * navigation site.
 *
 * Note: the `to` prop must still reference the typed route path including
 * the `$locale` segment (e.g. `to="/$locale/home"`) — TanStack Router's
 * typed-router lookup is path-based, not segment-based. The wrapper handles
 * the *param value*, not the path string.
 *
 * Pair this with the createLink wrapper below for design-system primitives
 * (e.g. `createLocaleLink(Button)` returns a typed link that injects the
 * locale param).
 */
import {
  Link,
  createLink,
  useParams,
  type LinkComponent,
} from "@tanstack/react-router";
import { forwardRef } from "react";

import { DEFAULT_LOCALE, isLocale } from "../lib/locale";

function useCurrentLocale(): string {
  const params = useParams({ strict: false }) as { locale?: string };
  return isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
}

/**
 * Wrap any component with `createLink`, then layer locale-injection on top.
 * Every consumer of the resulting link gets `params.locale` for free.
 */
export function createLocaleLink<TComponent>(component: TComponent) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TypedLink = createLink(component as any);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return forwardRef<unknown, any>(function LocaleLinked(props, ref) {
    const locale = useCurrentLocale();
    const merged = { locale, ...((props.params as object | undefined) ?? {}) };
    return <TypedLink {...props} ref={ref} params={merged} />;
  }) as unknown as LinkComponent<TComponent>;
}

/**
 * Drop-in `<LocaleLink>` for the raw router `<Link>`. Use anywhere you would
 * have used `<Link>` previously — the locale param flows through automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LocaleLink: LinkComponent<typeof Link> = forwardRef<
  unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>(function LocaleLink(props, ref) {
  const locale = useCurrentLocale();
  const merged = { locale, ...((props.params as object | undefined) ?? {}) };
  return <Link {...props} ref={ref} params={merged} />;
}) as unknown as LinkComponent<typeof Link>;
