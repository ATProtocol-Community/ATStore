const SM_BREAKPOINT = "(max-width: 40rem)";

export function useIsMobile() {
  return (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia(SM_BREAKPOINT).matches
  );
}
