import { describe, expect, it } from 'vitest'

import {
  buildListingMentionIndex,
  extractUrlsFromText,
  matchPostToListings,
} from '#/lib/trending/mention-matcher'

describe('extractUrlsFromText', () => {
  it('finds https URLs', () => {
    const urls = extractUrlsFromText('see https://example.com/foo ok')
    expect(urls.some((u) => u.includes('example.com'))).toBe(true)
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
})
