// external
import * as AWS from 'aws-sdk'
import imagemin from 'imagemin'
import imageminGifsicle from 'imagemin-gifsicle'
import imageminJpegtran from 'imagemin-jpegtran'
import imageminPngquant from 'imagemin-pngquant'
import imageminSvgo from 'imagemin-svgo'
import sizeOf from 'image-size'
import { v4 } from 'uuid'
import slugify from '@matters/slugify'
import sharp from 'sharp'
//local
import { S3Bucket, GQLAssetType } from 'definitions'
import {
  ACCEPTED_UPLOAD_IMAGE_TYPES,
  IMAGE_DIMENSION_LIMIT,
  LOCAL_S3_ENDPOINT
} from 'common/enums'
import { environment } from 'common/environment'
import { makeStreamToBuffer } from 'common/utils/makeStreamToBuffer'

export class AWSService {
  s3: AWS.S3

  s3Bucket: string

  s3Endpoint: string

  constructor() {
    AWS.config.update(this.getAWSConfig())
    this.s3 = new AWS.S3()
    this.s3Bucket = this.getS3Bucket()
    this.s3Endpoint = this.getS3Endpoint()
  }

  /**
   * Get AWS config.
   */
  getAWSConfig = () => {
    const { env, awsRegion, awsAccessId, awsAccessKey } = environment
    return {
      region: awsRegion || '',
      accessKeyId: awsAccessId || '',
      secretAccessKey: awsAccessKey || '',
      ...(env === 'development'
        ? { s3BucketEndpoint: true, endpoint: LOCAL_S3_ENDPOINT }
        : {})
    }
  }

  /**
   * Get S3 endpoint. If AWS Cloud Front is enabled, the default S3 endpoint
   * will be replaced.
   */
  getS3Endpoint = (): string => {
    const { env, awsS3Endpoint, awsCloudFrontEndpoint } = environment
    switch (env) {
      case 'staging':
      case 'production': {
        return `https://${awsCloudFrontEndpoint ||
          `${this.s3Bucket}.${awsS3Endpoint}`}`
      }
      default: {
        return `${LOCAL_S3_ENDPOINT}/${this.s3Bucket}`
      }
    }
  }

  /**
   * Get S3 bucket.
   */
  getS3Bucket = (): string => {
    const { awsS3Bucket } = environment
    return awsS3Bucket || 'matters-server-dev'
  }

  /**
   * Upload file to AWS S3.
   */
  baseUploadFile = async (
    folder: GQLAssetType,
    upload: any,
    uuid: string
  ): Promise<string> => {
    const { createReadStream, mimetype, encoding } = upload
    const stream = createReadStream()
    let buffer = await makeStreamToBuffer(stream)

    // Reduce image size
    if (mimetype && ACCEPTED_UPLOAD_IMAGE_TYPES.includes(mimetype)) {
      // Detect image dimension
      const { width, height } = sizeOf(buffer)
      if (Math.max(width, height) > IMAGE_DIMENSION_LIMIT) {
        buffer = await this.resizeImage(buffer, width, height)
      }

      // Compress image
      buffer = await imagemin.buffer(buffer, {
        plugins: [
          imageminGifsicle(),
          imageminJpegtran(),
          imageminPngquant(),
          imageminSvgo()
        ]
      })
    }

    const extension = upload.filename.split('.').pop()
    const filename = slugify(upload.filename.replace(`.${extension}`, ''))
    const key = `${folder}/${uuid}/${filename}.${extension}`
    const result = await this.s3
      .upload({
        Body: buffer,
        Bucket: this.s3Bucket,
        ContentEncoding: encoding,
        ContentType: mimetype,
        Key: key
      })
      .promise()
    return key
  }

  /**
   * Delete file from AWS S3 by a given path key.
   */
  baseDeleteFile = async (key: string): Promise<any> =>
    await this.s3
      .deleteObject({
        Bucket: this.s3Bucket,
        Key: key
      })
      .promise()

  /**
   * Resize image into specific size.
   */
  resizeImage = async (
    buffer: Buffer,
    width: number,
    height: number
  ): Promise<Buffer> => {
    const dimension: { width: number | null; height: number | null } = {
      width: null,
      height: null
    }
    if (width > height) {
      dimension.width = IMAGE_DIMENSION_LIMIT
    } else {
      dimension.height = IMAGE_DIMENSION_LIMIT
    }
    return sharp(buffer)
      .resize(dimension.width, dimension.height)
      .toBuffer()
  }
}

export const aws = new AWSService()
