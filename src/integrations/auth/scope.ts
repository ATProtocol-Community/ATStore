import { scope as atprotoScope } from '@atcute/oauth-node-client'

export const scope = [
  atprotoScope.account({ attr: 'email', action: 'read' }),
  atprotoScope.blob({ accept: ['image/*', 'video/*'] }),
  atprotoScope.repo({
    collection: [
      'fyi.atstore.profile',
      'fyi.atstore.listing.detail',
      'fyi.atstore.listing.review',
    ],
    action: ['create', 'update', 'delete'],
  }),
]
