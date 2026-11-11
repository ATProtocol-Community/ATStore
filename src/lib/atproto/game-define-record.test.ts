import {
  gameDefineToListingFields,
  normalizeGameUrlForMatch,
  tryParseGameDefineRecord,
} from "#/lib/atproto/game-define-record";
import { tryParseGameFaveRecord } from "#/lib/atproto/tap-game-sync";
import { describe, expect, it } from "vitest";

const HELD_BY = "did:plc:q2fua5gykeuir2hs2gkssygo";

/** Shape of a real record held by atmosphere.games (trimmed). */
const tictactoe = {
  $type: "games.atmosphere.define",
  url: "https://tictactoe.firehose.games",
  name: "Tic-Tac-Toe",
  tags: ["strategy"],
  uses: [
    {
      nsid: "games.firehose.tictactoe",
      rkey: "any",
      role: "activity",
      label: "Tic-Tac-Toe games",
      acquire: "https://tictactoe.firehose.games",
      purpose: "Game records for recent activity.",
    },
  ],
  cover: {
    $type: "blob",
    ref: {
      $link: "bafkreibryarlfwsvkq2j6iettmxmhggvnrrpydb7p6ujvchdnznn5qfz6y",
    },
    mimeType: "image/png",
    size: 43_824,
  },
  status: "live",
  category: "browser",
  createdAt: "2026-07-17T00:00:00.000Z",
  developer: {
    did: "did:plc:lwjyty2awvbugly52hdspklo",
    url: "https://bsky.app/profile/firehose.games",
    name: "firehose.games",
  },
  claimAllowed: ["did:plc:extra", "somehandle.bsky.social"],
  legacyIds: ["tictactoe"],
  publisher: `at://${HELD_BY}`,
  description: "Tic Tac Toe over the ATProto Firehose.",
};

describe("tryParseGameDefineRecord", () => {
  it("parses a held atmosphere.games record", () => {
    const result = tryParseGameDefineRecord(tictactoe);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.name).toBe("Tic-Tac-Toe");
    expect(result.record.developer?.did).toBe(
      "did:plc:lwjyty2awvbugly52hdspklo",
    );
    expect(result.record.uses).toHaveLength(1);
  });

  it("rejects records missing required fields", () => {
    // Non-game proof records share the collection (e.g. `jamdole-proof-*`).
    const result = tryParseGameDefineRecord({ jamDoleProof: "x" });
    expect(result.ok).toBe(false);
  });

  it("rejects non-http play URLs", () => {
    const result = tryParseGameDefineRecord({
      ...tictactoe,
      url: "javascript:alert(1)",
    });
    expect(result.ok).toBe(false);
  });

  it("drops malformed optional entries instead of failing the record", () => {
    const result = tryParseGameDefineRecord({
      ...tictactoe,
      trailers: [
        { nope: true },
        { title: "Launch", platform: "youtube", videoId: "abc" },
      ],
      developer: { did: "did:plc:x" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.trailers).toHaveLength(1);
    expect(result.record.developer).toBeUndefined();
  });
});

describe("gameDefineToListingFields", () => {
  it("maps blobs to CDN URLs and keeps game-only fields in gameDetails", () => {
    const parsed = tryParseGameDefineRecord(tictactoe);
    if (!parsed.ok) throw new Error(parsed.reason);
    const fields = gameDefineToListingFields({
      did: HELD_BY,
      rkey: "tictactoe",
      record: parsed.record,
    });
    expect(fields.heroImageUrl).toBe(
      `https://cdn.bsky.app/img/feed_fullsize/plain/${HELD_BY}/bafkreibryarlfwsvkq2j6iettmxmhggvnrrpydb7p6ujvchdnznn5qfz6y@png`,
    );
    expect(fields.iconUrl).toBeNull();
    expect(fields.gameDetails.defineAtUri).toBe(
      `at://${HELD_BY}/games.atmosphere.define/tictactoe`,
    );
    expect(fields.gameDetails.uses[0]).toMatchObject({
      nsid: "games.firehose.tictactoe",
      kind: "activity",
    });
    // Developer DID + DID-shaped claimAllowed entries; handles are ignored.
    expect(fields.gameDetails.claimantDids).toEqual([
      "did:plc:lwjyty2awvbugly52hdspklo",
      "did:plc:extra",
    ]);
  });

  it("flattens composite requirement rules into the collections they check", () => {
    const parsed = tryParseGameDefineRecord({
      ...tictactoe,
      requires: [
        {
          check: "any",
          label: "A character",
          rules: [
            { check: "record", nsid: "actor.rpg.stats" },
            {
              check: "vouch",
              nsid: "equipment.rpg.give",
              authority: "did:plc:auth",
              filters: [{ field: "to", op: "isPlayer" }],
            },
          ],
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.reason);
    const { gameDetails } = gameDefineToListingFields({
      did: HELD_BY,
      rkey: "x",
      record: parsed.record,
    });
    expect(gameDetails.requires).toEqual([
      expect.objectContaining({
        nsid: "actor.rpg.stats",
        kind: "record",
        label: "A character",
      }),
      expect.objectContaining({
        nsid: "equipment.rpg.give",
        kind: "vouch",
        label: "A character",
      }),
    ]);
  });
});

describe("normalizeGameUrlForMatch", () => {
  it("ignores scheme, www, trailing slash, query and hash", () => {
    expect(
      normalizeGameUrlForMatch("https://www.Example.com/play/?ref=x#top"),
    ).toBe("example.com/play");
    expect(normalizeGameUrlForMatch("http://example.com")).toBe("example.com");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeGameUrlForMatch("not a url")).toBeNull();
  });
});

describe("tryParseGameFaveRecord", () => {
  it("accepts a fave pointing at a define record", () => {
    const result = tryParseGameFaveRecord({
      $type: "games.atmosphere.fave",
      game: `at://${HELD_BY}/games.atmosphere.define/tictactoe`,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a bad createdAt", () => {
    const result = tryParseGameFaveRecord({
      game: `at://${HELD_BY}/games.atmosphere.define/tictactoe`,
      createdAt: "yesterday",
    });
    expect(result.ok).toBe(false);
  });
});
