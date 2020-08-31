import axios from 'axios'
import _ from 'lodash'
import { v4 } from 'uuid'

import {
  ACCEPTED_UPLOAD_AUDIO_TYPES,
  ACCEPTED_UPLOAD_IMAGE_TYPES,
  UPLOAD_AUDIO_SIZE_LIMIT,
  UPLOAD_IMAGE_SIZE_LIMIT,
} from 'common/enums'
import { UnableToUploadFromUrl, UserInputError } from 'common/errors'
import { fromGlobalId } from 'common/utils'
import { ItemData, MutationToSingleFileUploadResolver } from 'definitions'

const getFileName = (disposition: string, url: string) => {
  if (disposition) {
    const match = disposition.match(/filename="(.*)"/) || []
    if (match.length >= 2) {
      return decodeURI(match[1])
    }
  }

  if (url) {
    const fragment = url.split('/').pop()
    if (fragment) {
      return fragment.split('?')[0]
    }
  }
}

const resolver: MutationToSingleFileUploadResolver = async (
  root,
  { input: { type, file, url, entityType, entityId } },
  { viewer, dataSources: { systemService } }
) => {
  // https://github.com/Urigo/graphql-scalars#url
  url = _.get(url, 'href')

  const isImageType =
    [
      'avatar',
      'embed',
      'profileCover',
      'oauthClientAvatar',
      'tagCover',
    ].indexOf(type) >= 0
  const isAudioType = ['embedaudio'].indexOf(type) >= 0

  if ((!file && !url) || (file && url)) {
    throw new UserInputError('One of file and url needs to be specified.')
  }

  if (url && !isImageType) {
    throw new UserInputError(`type:${type} doesn\'t support specifying a url.`)
  }

  if (!entityType) {
    throw new UserInputError('Entity type needs to be specified.')
  }

  if (entityType !== 'user' && !entityId) {
    throw new UserInputError('Entity id needs to be specified.')
  }

  const relatedEntityId =
    entityType === 'user' ? viewer.id : fromGlobalId(entityId || '').id
  if (!relatedEntityId) {
    throw new UserInputError('Entity id is incorrect')
  }

  const { id: entityTypeId } = await systemService.baseFindEntityTypeId(
    entityType
  )
  if (!entityTypeId) {
    throw new UserInputError('Entity type is incorrect.')
  }

  let upload
  if (url) {
    try {
      const res = await axios.get(url, {
        responseType: 'stream',
        maxContentLength: UPLOAD_IMAGE_SIZE_LIMIT,
      })
      const disposition = res.headers['content-disposition']
      const filename = getFileName(disposition, url)

      upload = {
        createReadStream: () => res.data,
        mimetype: res.headers['content-type'],
        encoding: 'utf8',
        filename,
      }
    } catch (err) {
      throw new UnableToUploadFromUrl(`Unable to upload from url: ${err}`)
    }
  } else {
    upload = await file
  }

  // check MIME types
  if (upload.mimetype) {
    if (isImageType && !ACCEPTED_UPLOAD_IMAGE_TYPES.includes(upload.mimetype)) {
      throw new UserInputError('Invalid image format.')
    }

    if (isAudioType && !ACCEPTED_UPLOAD_AUDIO_TYPES.includes(upload.mimetype)) {
      throw new UserInputError('Invalid audio format.')
    }
  }

  const uuid = v4()
  const key = await systemService.aws.baseUploadFile(type, upload, uuid)
  const asset: ItemData = {
    uuid,
    authorId: viewer.id,
    type,
    path: key,
  }

  const newAsset = await systemService.createAssetAndAssetMap(
    asset,
    entityTypeId,
    relatedEntityId
  )

  return {
    ...newAsset,
    path: `${systemService.aws.s3Endpoint}/${newAsset.path}`,
  }
}

export default resolver
