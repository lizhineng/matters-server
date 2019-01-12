import { connectionFromPromisedArray } from 'graphql-relay'

import { QueryToSearchResolver, GQLNode } from 'definitions'

const resolver: QueryToSearchResolver = (
  _,
  { input },
  {
    dataSources: { systemService, articleService, userService, tagService },
    viewer
  }
) => {
  systemService.baseCreate(
    { userId: viewer ? viewer.id : null, searchKey: input.key },
    'search_history'
  )

  const serviceMap = {
    Article: articleService,
    User: userService,
    Tag: tagService
  }
  return connectionFromPromisedArray(
    serviceMap[input.type]
      .search(input)
      .then(nodes =>
        nodes.map((node: GQLNode) => ({ ...node, __type: input.type }))
      ),
    input
  )
}

export default resolver
