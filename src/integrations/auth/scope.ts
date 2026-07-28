import { scope as atprotoScope } from "@atcute/oauth-node-client";

export const scope = [
  // atprotoScope.account({ attr: 'email', action: 'read' }),
  atprotoScope.blob({ accept: ["image/*", "video/*"] }),
  // NOT atprotoScope.include({ nsid }) — that builds the query form
  // `include?nsid=fyi.atstore.authBasic`, which some authorization servers
  // reject with "Unsupported scope". `include:<nsid>` is the canonical
  // positional form the atproto reference implementation normalizes to.
  "include:fyi.atstore.authBasic",
];
