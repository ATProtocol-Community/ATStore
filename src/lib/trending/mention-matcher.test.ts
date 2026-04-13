import { describe, expect, it } from 'vitest'

import {
  buildListingMentionIndex,
  extractAtHandleMentionsFromText,
  extractBskyAppProfileHandlesFromUrls,
  extractUrlsFromText,
  matchPostToListings,
  urlPathContainsSlug,
} from '#/lib/trending/mention-matcher'

describe('extractUrlsFromText', () => {
  it('finds https URLs', () => {
    const urls = extractUrlsFromText('see https://example.com/foo ok')
    expect(urls.some((u) => u.includes('example.com'))).toBe(true)
  })

  it('finds several URLs and strips trailing punctuation', () => {
    const text =
      'A https://a.com/x), B http://b.io/y; C https://c.test/z.'
    const urls = extractUrlsFromText(text)
    expect(urls).toContain('https://a.com/x')
    expect(urls.some((u) => u.includes('b.io'))).toBe(true)
    expect(urls.some((u) => u.includes('c.test'))).toBe(true)
  })
})

describe('extractAtHandleMentionsFromText', () => {
  it('extracts domain-style @handles without facets', () => {
    expect(
      extractAtHandleMentionsFromText(
        'shoutout to @cool.app.bsky.social for the launch',
      ),
    ).toContain('cool.app.bsky.social')
  })

  it('returns multiple distinct handles', () => {
    const h = extractAtHandleMentionsFromText(
      '@one.bsky.social and @two.social see',
    )
    expect(h).toContain('one.bsky.social')
    expect(h).toContain('two.social')
  })

  it('does not treat @here or @everyone as handles', () => {
    expect(extractAtHandleMentionsFromText('@here @everyone ping')).toEqual([])
  })
})

describe('extractBskyAppProfileHandlesFromUrls', () => {
  it('parses handle from bsky.app profile URL', () => {
    expect(
      extractBskyAppProfileHandlesFromUrls([
        'https://bsky.app/profile/myproduct.bsky.social/post/abc123',
      ]),
    ).toEqual(['myproduct.bsky.social'])
  })

  it('ignores did: profile URLs (no handle in index)', () => {
    expect(
      extractBskyAppProfileHandlesFromUrls([
        'https://bsky.app/profile/did:plc:abcdef/post/xyz',
      ]),
    ).toEqual([])
  })
})

describe('urlPathContainsSlug', () => {
  it('matches slug as path segment', () => {
    expect(
      urlPathContainsSlug(
        'https://news.ycombinator.com/item?id=1',
        'item',
      ),
    ).toBe(true)
    expect(
      urlPathContainsSlug('https://example.com/docs/my-cool-app/setup', 'my-cool-app'),
    ).toBe(true)
  })

  it('does not substring-match slug inside another segment', () => {
    expect(urlPathContainsSlug('https://x.com/foo/barlong', 'bar')).toBe(false)
  })
})

describe('matchPostToListings', () => {
  it('matches by domain from URL', () => {
    const index = buildListingMentionIndex([
      {
        id: 'a',
        name: 'Foo',
        slug: 'foo',
        sourceUrl: 'https://coolapp.example.com',
        externalUrl: null,
        productAccountHandle: null,
      },
    ])
    const hits = matchPostToListings({
      index,
      text: 'nice',
      urls: ['https://coolapp.example.com/pricing'],
      facetHandles: [],
    })
    expect(hits.some((h) => h.storeListingId === 'a' && h.matchType === 'url')).toBe(
      true,
    )
  })

  it('matches product handle from facet handles list', () => {
    const index = buildListingMentionIndex([
      {
        id: 'b',
        name: 'Bar',
        slug: 'bar',
        sourceUrl: 'https://x.com',
        externalUrl: null,
        productAccountHandle: 'myproduct.bsky.social',
      },
    ])
    const hits = matchPostToListings({
      index,
      text: '',
      urls: [],
      facetHandles: ['myproduct.bsky.social'],
    })
    expect(
      hits.some((h) => h.storeListingId === 'b' && h.matchType === 'handle'),
    ).toBe(true)
  })

  it('matches handle from plain @mention in text (no facets)', () => {
    const index = buildListingMentionIndex([
      {
        id: 'c',
        name: 'Plain',
        slug: 'plain',
        sourceUrl: 'https://plain.dev',
        externalUrl: null,
        productAccountHandle: 'plainapp.bsky.social',
      },
    ])
    const hits = matchPostToListings({
      index,
      text: 'follow @plainapp.bsky.social for updates!',
      urls: [],
      facetHandles: [],
    })
    expect(
      hits.some((h) => h.storeListingId === 'c' && h.matchType === 'handle'),
    ).toBe(true)
  })

  it('matches handle from bsky.app post URL alone', () => {
    const index = buildListingMentionIndex([
      {
        id: 'd',
        name: 'Post',
        slug: 'post',
        sourceUrl: 'https://post.dev',
        externalUrl: null,
        productAccountHandle: 'poster.bsky.social',
      },
    ])
    const hits = matchPostToListings({
      index,
      text: '',
      urls: ['https://bsky.app/profile/poster.bsky.social/post/abc123'],
      facetHandles: [],
    })
    expect(
      hits.some((h) => h.storeListingId === 'd' && h.matchType === 'handle'),
    ).toBe(true)
  })

  it('does not match listing slug in URL path when host differs', () => {
    const index = buildListingMentionIndex([
      {
        id: 'e',
        name: 'Long Name Here',
        slug: 'long-name-here',
        sourceUrl: 'https://official.example.com',
        externalUrl: null,
        productAccountHandle: null,
      },
    ])
    const hits = matchPostToListings({
      index,
      text: 'read this',
      urls: ['https://blog.partner.org/reviews/long-name-here'],
      facetHandles: [],
    })
    expect(hits.some((h) => h.storeListingId === 'e')).toBe(false)
  })

  it('matches listing slug path on listing domain', () => {
    const index = buildListingMentionIndex([
      {
        id: 'anchor',
        name: 'Anchor',
        slug: 'anchor',
        sourceUrl: 'https://dropanchor.app',
        externalUrl: null,
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'feature docs',
      urls: ['https://dropanchor.app/anchor/setup'],
      facetHandles: [],
    })

    const urlHit = hits.find(
      (h) => h.storeListingId === 'anchor' && h.matchType === 'url',
    )
    expect(urlHit).toBeDefined()
    expect(urlHit?.confidence).toBeGreaterThanOrEqual(0.82)
  })

  it('does not match anchor slug path on unrelated domain', () => {
    const index = buildListingMentionIndex([
      {
        id: 'anchor2',
        name: 'Anchor',
        slug: 'anchor',
        sourceUrl: 'https://dropanchor.app',
        externalUrl: null,
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'news',
      urls: ['https://briefly.co/anchor/world-news/story/foo'],
      facetHandles: [],
    })

    expect(hits.some((h) => h.storeListingId === 'anchor2')).toBe(false)
  })

  it('matches standard.site context with slug in text', () => {
    const index = buildListingMentionIndex([
      {
        id: 'g',
        name: 'Lexicon Tool',
        slug: 'lexicon-tool',
        sourceUrl: 'https://lexicon-tool.dev',
        externalUrl: 'https://lexicon-tool.dev',
        productAccountHandle: null,
      },
    ])
    const hits = matchPostToListings({
      index,
      text: 'see standard.site and lexicon-tool docs',
      urls: ['https://standard.site/foo'],
      facetHandles: [],
    })
    expect(
      hits.some(
        (h) => h.storeListingId === 'g' && h.matchType === 'standard_site_doc',
      ),
    ).toBe(true)
  })

  it('omits URL/domain matches for the Bluesky platform root listing (apps/bluesky)', () => {
    const index = buildListingMentionIndex([
      {
        id: 'bsky',
        name: 'Bluesky',
        slug: 'bluesky',
        sourceUrl: 'https://bsky.app',
        externalUrl: null,
        productAccountHandle: 'bsky.app',
        categorySlugs: ['apps/bluesky'],
      },
    ])
    const fromGenericBskyLink = matchPostToListings({
      index,
      text: '',
      urls: ['https://bsky.app/profile/someone/post/xyz'],
      facetHandles: [],
    })
    expect(fromGenericBskyLink.some((h) => h.matchType === 'url')).toBe(false)

    const fromHandle = matchPostToListings({
      index,
      text: '',
      urls: [],
      facetHandles: ['bsky.app'],
    })
    expect(
      fromHandle.some(
        (h) => h.storeListingId === 'bsky' && h.matchType === 'handle',
      ),
    ).toBe(true)
  })

  it('does not domain-match listings solely because their URL is on github.com', () => {
    const index = buildListingMentionIndex([
      {
        id: 'gh',
        name: 'Repo Backed App',
        slug: 'repo-backed-app',
        sourceUrl: 'https://repo-backed-app.com',
        externalUrl: 'https://github.com/acme/repo-backed-app',
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'shipping a fix, see github for details',
      urls: ['https://github.com/other-org/other-repo/issues/1'],
      facetHandles: [],
    })

    expect(hits.some((h) => h.storeListingId === 'gh')).toBe(false)
  })

  it('matches listing by exact github URL', () => {
    const index = buildListingMentionIndex([
      {
        id: 'gh2',
        name: 'Repo Exact URL App',
        slug: 'repo-exact-url',
        sourceUrl: 'https://repo-exact-url.com',
        externalUrl: 'https://github.com/acme/repo-exact-url',
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'release notes',
      urls: ['https://github.com/acme/repo-exact-url'],
      facetHandles: [],
    })

    expect(
      hits.some((h) => h.storeListingId === 'gh2' && h.matchType === 'url'),
    ).toBe(true)
  })

  it('does not match github child paths when exact URL differs', () => {
    const index = buildListingMentionIndex([
      {
        id: 'gh3',
        name: 'Repo Child Paths',
        slug: 'repo-child-paths',
        sourceUrl: 'https://repo-child-paths.com',
        externalUrl: 'https://github.com/acme/repo-child-paths',
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'see release notes',
      urls: ['https://github.com/acme/repo-child-paths/releases/tag/v1.0.0'],
      facetHandles: [],
    })

    expect(hits.some((h) => h.storeListingId === 'gh3')).toBe(false)
  })

  it('does not domain-match listings solely because their URL is on apps.apple.com', () => {
    const index = buildListingMentionIndex([
      {
        id: 'ios1',
        name: 'Today App',
        slug: 'today-app',
        sourceUrl: 'https://today-app.dev',
        externalUrl: 'https://apps.apple.com/us/app/today/id1234567890',
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'check this app',
      urls: ['https://apps.apple.com/us/app/other/id0987654321'],
      facetHandles: [],
    })

    expect(hits.some((h) => h.storeListingId === 'ios1')).toBe(false)
  })

  it('matches listing by exact apps.apple.com URL', () => {
    const index = buildListingMentionIndex([
      {
        id: 'ios2',
        name: 'Exact iOS App',
        slug: 'exact-ios-app',
        sourceUrl: 'https://exact-ios-app.dev',
        externalUrl: 'https://apps.apple.com/us/app/exact-ios-app/id4242424242',
        productAccountHandle: null,
      },
    ])

    const hits = matchPostToListings({
      index,
      text: 'new update',
      urls: ['https://apps.apple.com/us/app/exact-ios-app/id4242424242?platform=iphone'],
      facetHandles: [],
    })

    expect(
      hits.some((h) => h.storeListingId === 'ios2' && h.matchType === 'url'),
    ).toBe(true)
  })

  it('keeps highest-confidence hit when multiple signals match', () => {
    const index = buildListingMentionIndex([
      {
        id: 'h',
        name: 'Same',
        slug: 'same',
        sourceUrl: 'https://same.app',
        externalUrl: null,
        productAccountHandle: 'same.bsky.social',
      },
    ])
    const hits = matchPostToListings({
      index,
      text: '@same.bsky.social check https://same.app',
      urls: ['https://same.app/x'],
      facetHandles: [],
    })
    const byId = new Map(hits.map((x) => [x.storeListingId, x]))
    expect(byId.get('h')?.matchType).toBe('handle')
    expect(byId.get('h')?.confidence).toBeGreaterThanOrEqual(0.9)
  })
})
