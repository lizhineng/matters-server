import * as cheerio from 'cheerio'
import _ from 'lodash'

export * from './makeContext'
export * from './getFileName'
export * from './getLanguage'
export * from './getViewer'
export * from './globalId'
export * from './initSubscriptions'
export * from './connections'
export * from './validator'
export * from './notice'
export * from './getViewer'
export * from './cookie'
export * from './removeEmpty'
export * from './xss'
export * from './makeStreamToBuffer'
export * from './content'
export * from './scope'
export * from './payment'
export * from './time'

/**
 * Make a valid user name based on a given email address. It removes all special characters including _.
 * Also, leave 3 charateres for appending postfix when it's a duplicated user name.
 */
export const makeUserName = (email: string): string => {
  const matched = email.split('@')[0].match(/[a-zA-Z0-9_]*/g)

  if (!matched) {
    return ''
  }

  return matched.join('').substring(0, 18)
}

export const extractAssetDataFromHtml = (
  html: string,
  type?: 'image' | 'audio'
) => {
  const $ = cheerio.load(html || '', { decodeEntities: false })

  let selector = '[data-asset-id]'

  if (type === 'image') {
    selector = 'figure.image [data-asset-id]'
  } else if (type === 'audio') {
    selector = 'figure.audio [data-asset-id]'
  }

  return $(selector)
    .map((index: number, element: CheerioElement) => {
      const uuid = $(element).attr('data-asset-id')

      if (uuid) {
        return uuid
      }
    })
    .get()
}
