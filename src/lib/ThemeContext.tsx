import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { user } from "#/integrations/tanstack-query/api-user.functions";
import { useCallback, useEffect, useState } from "react";

import type { ThemeMode } from "./theme";

import { DEFAULT_THEME_MODE } from "./theme";

export interface ThemeContextValue {
  /** The user's chosen mode (`light | dark | system`). */
  mode: ThemeMode;
  /** Concrete scheme being applied right now (`light | dark`); resolves `system` via `prefers-color-scheme`. */
  resolvedScheme: "light" | "dark";
  /** Persist a new theme mode (DB if signed-in, cookie otherwise). */
  setMode: (next: ThemeMode) => void;
  /** Whether a setMode mutation is currently in flight. */
  isPending: boolean;
}

function getSystemColorScheme(): "light" | "dark" {
  if (typeof globalThis.matchMedia !== "function") {
    return "light";
  }
  return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Read + update the theme preference.
 *
 * Source of truth lives in the `themePreference` query (cookie- and DB-backed
 * via the `user.setThemePreference` server fn). The mutation writes through to
 * the server and patches the cache so all consumers re-render together.
 *
 * We deliberately don't expose a context Provider — TanStack Query already
 * gives us the broadcast semantics we need, and avoiding a separate state
 * source prevents drift after server-side updates.
 */
export function useTheme(): ThemeContextValue {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...user.getThemePreferenceQueryOptions,
    // SSR will have populated the cache already; we never want to refetch on
    // mount because the cookie/DB don't change without a mutation we ran.
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const mode = data?.mode ?? DEFAULT_THEME_MODE;

  const [systemScheme, setSystemScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setSystemScheme(getSystemColorScheme());

    if (typeof globalThis.matchMedia !== "function") return;

    const media = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => {
      setSystemScheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const setMutation = useMutation({
    mutationFn: async (next: ThemeMode) => {
      return await user.setThemePreference({ data: { mode: next } });
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({
        queryKey: user.getThemePreferenceQueryOptions.queryKey,
      });
      const previous = queryClient.getQueryData(
        user.getThemePreferenceQueryOptions.queryKey,
      );
      queryClient.setQueryData(user.getThemePreferenceQueryOptions.queryKey, {
        mode: next,
      });
      return { previous };
    },
    onError: (_error, _next, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(
          user.getThemePreferenceQueryOptions.queryKey,
          ctx.previous,
        );
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(
        user.getThemePreferenceQueryOptions.queryKey,
        result,
      );
    },
  });

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (next === mode) return;
      setMutation.mutate(next);
    },
    [mode, setMutation],
  );

  return {
    mode,
    resolvedScheme: mode === "system" ? systemScheme : mode,
    setMode,
    isPending: setMutation.isPending,
  };
}
