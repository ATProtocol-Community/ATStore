import { scope as atprotoScope } from "@atcute/oauth-node-client";

export const scope = [
  // atprotoScope.account({ attr: 'email', action: 'read' }),
  atprotoScope.blob({ accept: ["image/*", "video/*"] }),
  atprotoScope.include({ nsid: "fyi.atstore.authBasic" }),
];
