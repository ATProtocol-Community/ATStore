/**
 * Seed the local database with a handful of realistic ATProto-ecosystem
 * listings + a couple of reviews so a fresh `pnpm dev` renders something
 * on the home page without having to run the scrapers.
 *
 *   pnpm db:seed
 *
 * Idempotent: re-running will not duplicate listings (matched on source_url).
 * Safe to run on any non-production database; refuses to run if
 * DATABASE_URL points anywhere other than localhost / 127.0.0.1 unless
 * `ALLOW_REMOTE_SEED=1` is set.
 */
import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import { db, dbClient } from '../src/db/index.server'
import {
  storeListings,
  storeListingReviews,
  type NewStoreListing,
} from '../src/db/schema'

type SeedListing = Omit<
  NewStoreListing,
  'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'averageRating'
> & {
  /** Optional reviews to insert after the listing exists. */
  reviews?: Array<{
    authorDid: string
    authorDisplayName: string
    rating: number
    text: string
  }>
}

const SEED_LISTINGS: SeedListing[] = [
  {
    sourceUrl: 'seed:bsky-app',
    name: 'Bluesky',
    slug: 'bluesky',
    externalUrl: 'https://bsky.app',
    iconUrl: null,
    tagline: 'A social network built on the AT Protocol.',
    fullDescription:
      'Bluesky is the flagship social client for the AT Protocol — microblogging with portable identity, custom feeds, and open moderation.',
    categorySlugs: ['apps/bluesky'],
    appTags: ['bluesky', 'social', 'microblogging'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:graysky',
    name: 'Graysky',
    slug: 'graysky',
    externalUrl: 'https://graysky.app',
    iconUrl: null,
    tagline: 'A third-party Bluesky client for iOS and Android.',
    fullDescription:
      'Graysky is a polished, third-party mobile client for Bluesky with translations, in-app browser, and pro features.',
    categorySlugs: ['apps/graysky'],
    appTags: ['bluesky', 'mobile', 'client'],
    verificationStatus: 'verified',
    reviews: [
      {
        authorDid: 'did:plc:seed-reviewer-1',
        authorDisplayName: 'Demo Reviewer',
        rating: 5,
        text: 'My favorite Bluesky client — fast, polished, and the translation feature is killer.',
      },
      {
        authorDid: 'did:plc:seed-reviewer-2',
        authorDisplayName: 'Another Demo User',
        rating: 4,
        text: 'Great mobile client, occasionally a bit ahead of the upstream API.',
      },
    ],
  },
  {
    sourceUrl: 'seed:skyfeed',
    name: 'SkyFeed',
    slug: 'skyfeed',
    externalUrl: 'https://skyfeed.app',
    iconUrl: null,
    tagline: 'Build and publish custom Bluesky feeds visually.',
    fullDescription:
      'SkyFeed is a no-code feed builder for the AT Protocol — design custom feed algorithms with a visual graph and publish them to Bluesky.',
    categorySlugs: ['apps/skyfeed'],
    appTags: ['bluesky', 'feeds', 'no-code'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:smokesignal',
    name: 'Smoke Signal',
    slug: 'smoke-signal',
    externalUrl: 'https://smokesignal.events',
    iconUrl: null,
    tagline: 'Events and RSVPs on the AT Protocol.',
    fullDescription:
      'Smoke Signal is an event-hosting and RSVP application built on top of the AT Protocol.',
    categorySlugs: ['apps/smoke-signal'],
    appTags: ['events', 'rsvp', 'community'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:whitewind',
    name: 'WhiteWind',
    slug: 'whitewind',
    externalUrl: 'https://whtwnd.com',
    iconUrl: null,
    tagline: 'A long-form Markdown blog backed by your PDS.',
    fullDescription:
      'WhiteWind lets you publish long-form Markdown blog posts as records in your own ATProto repository.',
    categorySlugs: ['apps/whitewind'],
    appTags: ['blog', 'writing', 'markdown'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:frontpage',
    name: 'Frontpage',
    slug: 'frontpage',
    externalUrl: 'https://frontpage.fyi',
    iconUrl: null,
    tagline: 'A link-aggregator and discussion site on the AT Protocol.',
    fullDescription:
      'Frontpage is a Hacker News–style link aggregator built on the AT Protocol, with comments and voting as portable records.',
    categorySlugs: ['apps/frontpage'],
    appTags: ['link-sharing', 'discussion'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:bookhive',
    name: 'Bookhive',
    slug: 'bookhive',
    externalUrl: 'https://bookhive.buzz',
    iconUrl: null,
    tagline: 'Track and review books — a Goodreads alternative on ATProto.',
    fullDescription:
      'Bookhive is a community-driven book-tracking and review app powered by the AT Protocol.',
    categorySlugs: ['apps/bookhive'],
    appTags: ['books', 'reviews', 'tracking'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:atfile',
    name: 'atfile',
    slug: 'atfile',
    externalUrl: 'https://github.com/electricduck/atfile',
    iconUrl: null,
    tagline: 'Store and manage files in your ATProto PDS from the CLI.',
    fullDescription:
      'atfile is a command-line tool for storing arbitrary files as records in your ATProto Personal Data Server.',
    categorySlugs: ['apps/atfile'],
    appTags: ['cli', 'storage', 'files'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:teal-fm',
    name: 'teal.fm',
    slug: 'teal-fm',
    externalUrl: 'https://teal.fm',
    iconUrl: null,
    tagline: 'Cross-platform listening history and music discovery on ATProto.',
    fullDescription:
      'teal.fm tracks what you listen to across services and shares it through your ATProto identity.',
    categorySlugs: ['apps/teal-fm'],
    appTags: ['music', 'scrobble', 'history'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:linkat',
    name: 'Linkat',
    slug: 'linkat',
    externalUrl: 'https://linkat.blue',
    iconUrl: null,
    tagline: 'A Linktree-style profile page powered by your PDS.',
    fullDescription:
      'Linkat lets you build a personal links page whose data lives as a record in your own ATProto repository.',
    categorySlugs: ['apps/linkat'],
    appTags: ['profile', 'links', 'pds'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:goat',
    name: 'goat',
    slug: 'goat-cli',
    externalUrl: 'https://github.com/bluesky-social/goat',
    iconUrl: null,
    tagline: 'The official ATProto Swiss-army CLI.',
    fullDescription:
      'goat is the official command-line tool for working with the AT Protocol — repo introspection, lexicon publishing, and identity tooling.',
    categorySlugs: ['protocol/tooling'],
    appTags: ['cli', 'atproto', 'lexicon'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:bluesky-pds',
    name: 'Bluesky PDS',
    slug: 'bluesky-pds',
    externalUrl: 'https://github.com/bluesky-social/pds',
    iconUrl: null,
    tagline: 'Self-host your own Personal Data Server.',
    fullDescription:
      'The reference implementation of an ATProto Personal Data Server, packaged for self-hosting on a small VPS.',
    categorySlugs: ['protocol/pds'],
    appTags: ['pds', 'self-hosted', 'infrastructure'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:ozone',
    name: 'Ozone',
    slug: 'ozone',
    externalUrl: 'https://github.com/bluesky-social/ozone',
    iconUrl: null,
    tagline: 'Open moderation tooling for the AT Protocol.',
    fullDescription:
      'Ozone is the moderation service that powers Bluesky labels and reports — runnable by anyone who wants to operate a labeler.',
    categorySlugs: ['protocol/moderation'],
    appTags: ['moderation', 'labeler', 'infrastructure'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:bigsky',
    name: 'Bigsky',
    slug: 'bigsky',
    externalUrl: 'https://github.com/bluesky-social/indigo',
    iconUrl: null,
    tagline: 'The reference relay implementation for ATProto.',
    fullDescription:
      'Bigsky (part of the Indigo monorepo) is the production relay that aggregates the firehose for the AT Protocol network.',
    categorySlugs: ['protocol/relay'],
    appTags: ['relay', 'firehose', 'infrastructure'],
    verificationStatus: 'verified',
  },
  {
    sourceUrl: 'seed:constellation',
    name: 'Constellation',
    slug: 'constellation',
    externalUrl: 'https://constellation.microcosm.blue',
    iconUrl: null,
    tagline: 'A global backlinks index for the AT Protocol.',
    fullDescription:
      'Constellation indexes references across ATProto records so apps can answer "who linked to this?" without crawling the firehose themselves.',
    categorySlugs: ['protocol/appview'],
    appTags: ['appview', 'index', 'backlinks'],
    verificationStatus: 'verified',
  },
]

function isLocalDatabase(url: string) {
  try {
    const u = new URL(url)
    return (
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1' ||
      u.hostname === '::1'
    )
  } catch {
    return false
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  if (!isLocalDatabase(url) && process.env.ALLOW_REMOTE_SEED !== '1') {
    console.error(
      `Refusing to seed: DATABASE_URL points at a non-local host.\n` +
        `Set ALLOW_REMOTE_SEED=1 to override.`,
    )
    process.exit(1)
  }

  let inserted = 0
  let skipped = 0
  let reviewsInserted = 0

  for (const seed of SEED_LISTINGS) {
    const { reviews, ...listing } = seed

    // Upsert: re-running the seed should keep the row in sync with the
    // values defined here (so renamed categories / fixed slugs propagate).
    const result = await db
      .insert(storeListings)
      .values(listing)
      .onConflictDoUpdate({
        target: storeListings.sourceUrl,
        set: {
          name: listing.name,
          slug: listing.slug,
          externalUrl: listing.externalUrl,
          iconUrl: listing.iconUrl,
          tagline: listing.tagline,
          fullDescription: listing.fullDescription,
          categorySlugs: listing.categorySlugs,
          appTags: listing.appTags,
          verificationStatus: listing.verificationStatus,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: storeListings.id,
        wasInserted: sql<boolean>`(xmax = 0)`,
      })

    const row = result[0]
    if (row.wasInserted) {
      inserted += 1
    } else {
      skipped += 1
    }
    const listingId = row.id

    if (!reviews?.length) continue

    let reviewRowsInsertedForListing = 0
    for (const review of reviews) {
      const rkey = `seed-${review.authorDid.slice(-12)}`
      const atUri = `at://${review.authorDid}/fyi.atstore.listing.review/${rkey}`
      const ins = await db
        .insert(storeListingReviews)
        .values({
          storeListingId: listingId,
          authorDid: review.authorDid,
          rkey,
          atUri,
          rating: review.rating,
          text: review.text,
          authorDisplayName: review.authorDisplayName,
          reviewCreatedAt: new Date(),
        })
        .onConflictDoNothing({ target: storeListingReviews.atUri })
        .returning({ id: storeListingReviews.id })
      if (ins.length > 0) reviewRowsInsertedForListing += 1
    }
    reviewsInserted += reviewRowsInsertedForListing

    if (reviewRowsInsertedForListing > 0) {
      const stats = await db
        .select({
          count: sql<number>`count(*)::int`,
          avg: sql<number>`avg(${storeListingReviews.rating})::float8`,
        })
        .from(storeListingReviews)
        .where(eq(storeListingReviews.storeListingId, listingId))
      const { count, avg } = stats[0]
      await db
        .update(storeListings)
        .set({ reviewCount: count, averageRating: avg })
        .where(eq(storeListings.id, listingId))
    }
  }

  console.log(
    `\nSeed complete: ${inserted} listing(s) inserted, ${skipped} updated in place, ` +
      `${reviewsInserted} review(s) inserted.`,
  )
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await dbClient.end({ timeout: 5 })
  })
