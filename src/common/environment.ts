import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
dotenv.config()

let firebaseCert = {}
if (process.env.MATTERS_FIREBASE_CREDENTIALS) {
  const filePath = path.resolve(
    __dirname,
    `../../${process.env.MATTERS_FIREBASE_CREDENTIALS}`
  )

  try {
    firebaseCert = require(filePath)
    console.log(
      new Date(),
      `Succeeded to load firebase credentials on ${filePath}`
    )
  } catch (e) {
    console.error(
      new Date(),
      `Failed to load firebase credentials on ${filePath}`
    )
  }
}

let OICDPrivateKey = ''
if (process.env.MATTERS_OICD_PRIVATE_KEY) {
  const filePath = path.resolve(
    __dirname,
    `../../${process.env.MATTERS_OICD_PRIVATE_KEY}`
  )

  try {
    OICDPrivateKey = fs.readFileSync(filePath, { encoding: 'utf8' })
    console.log(new Date(), `Succeeded to load OICD private key on ${filePath}`)
  } catch (e) {
    console.error(new Date(), `Failed to load OICD private key on ${filePath}`)
  }
}

/**
 * Here are all environment variables that server needs. Please add prefix
 * `MATTERS_` before environment variables.
 */

export const environment = {
  env: process.env.MATTERS_ENV || 'development',
  domain: process.env.MATTERS_DOMAIN,
  siteDomain: process.env.MATTERS_SITE_DOMAIN as string,
  awsRegion: process.env.MATTERS_AWS_REGION,
  awsAccessId: process.env.MATTERS_AWS_ACCESS_ID,
  awsAccessKey: process.env.MATTERS_AWS_ACCESS_KEY,
  awsS3Endpoint: process.env.MATTERS_AWS_S3_ENDPOINT,
  awsS3Bucket: process.env.MATTERS_AWS_S3_BUCKET,
  esHost: process.env.MATTERS_ELASTICSEARCH_HOST,
  esPort: process.env.MATTERS_ELASTICSEARCH_PORT,
  awsCloudFrontEndpoint: process.env.MATTERS_AWS_CLOUD_FRONT_ENDPOINT,
  pgHost: process.env.MATTERS_PG_HOST,
  pgUser: process.env.MATTERS_PG_USER,
  pgPassword: process.env.MATTERS_PG_PASSWORD,
  pgDatabase: process.env.MATTERS_PG_DATABASE,
  ipfsHost: process.env.MATTERS_IPFS_HOST,
  ipfsPort: process.env.MATTERS_IPFS_PORT || '5001',
  pubSubHost: process.env.MATTERS_PUBSUB_HOST as string,
  pubSubPort: (process.env.MATTERS_PUBSUB_PORT || 6379) as number,
  queueHost: process.env.MATTERS_QUEUE_HOST as string,
  queuePort: (process.env.MATTERS_QUEUE_PORT || 6379) as number,
  cacheHost: process.env.MATTERS_CACHE_HOST as string,
  cachePort: (process.env.MATTERS_CACHE_PORT || 6379) as number,
  sgKey: process.env.MATTERS_SENDGRID_API_KEY,
  emailFromAsk: process.env.MATTERS_EMAIL_FROM_ASK,
  jwtSecret: process.env.MATTERS_JWT_SECRET || '_dev_jwt_secret_',
  apiKey: process.env.MATTERS_APOLLO_API_KEY,
  sentryDsn: process.env.MATTERS_SENTRY_DSN,
  firebaseCert,
  gcpProjectId: process.env.MATTERS_GCP_PROJECT_ID,
  translateCertPath: process.env.MATTERS_TRANSLATE_CREDENTIAL_PATH,
  recaptchaSecret: process.env.MATTERS_RECAPTCHA_KEY,
  OICDPrivateKey,
  likecoinOAuthClientName: process.env.MATTERS_LIKECOIN_OAUTH_CLIENT_NAME || '',
  likecoinMigrationApiURL: process.env.MATTERS_LIKECOIN_MIGRATION_API_URL || '',
  likecoinApiURL: process.env.MATTERS_LIKECOIN_API_URL || '',
  likecoinAuthorizationURL: process.env.MATTERS_LIKECOIN_AUTH_URL || '',
  likecoinTokenURL: process.env.MATTERS_LIKECOIN_TOKEN_URL || '',
  likecoinClientId: process.env.MATTERS_LIKECOIN_CLIENT_ID || '',
  likecoinClientSecret: process.env.MATTERS_LIKECOIN_CLIENT_SECRET || '',
  likecoinCallbackURL: process.env.MATTERS_LIKECOIN_CALLBACK_URL || '',
  oAuthSecret: process.env.MATTERS_OAUTH_SECRET || '',
  stripeSecret: process.env.MATTERS_STRIPE_SECRET || '',
  stripeWebhookSecret: process.env.MATTERS_STRIPE_WEBHOOK_SECRET || '',
}

export const isDev = environment.env.includes('dev')
export const isTest = environment.env.includes('test')
export const isProd = environment.env.includes('prod')
