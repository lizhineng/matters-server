import slugify from '@matters/slugify'

import { toGlobalId, countWords, makeSummary } from 'common/utils'

import drafts from './drafts'
import audiodrafts from './audiodrafts'
import cover from './cover'
import upstream from './upstream'
import audio from './audio'

export default {
  User: {
    drafts,
    audiodrafts
  },
  Draft: {
    id: ({ id }: { id: string }) => toGlobalId({ type: 'Draft', id }),
    slug: ({ title }: { title: string }) => slugify(title),
    wordCount: ({ content }: { content?: string }) =>
      content ? countWords(content) : 0,
    summary: ({ content, cover }: { content?: string; cover?: string }) =>
      content ? makeSummary(content, cover ? 110 : 140) : '',
    cover,
    upstream
  },
  Audiodraft: {
    id: ({ uuid }: { uuid: string }) => uuid,
    authorId: ({ id }: { id: string }) => toGlobalId({ type: 'User', id }),
    audio
  }
}
