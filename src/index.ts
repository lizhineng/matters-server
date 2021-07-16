import * as Sentry from '@sentry/node'
import cors from 'cors'
import express, { RequestHandler } from 'express'
import * as firebase from 'firebase-admin'
import helmet from 'helmet'
import http from 'http'
import 'module-alias/register'
import requestIp from 'request-ip'

import { CORS_OPTIONS, SERVER_TIMEOUT } from 'common/enums'
import { environment } from 'common/environment'

import * as routes from './routes'

/**
 * Init
 */
// Sentry
Sentry.init({ dsn: environment.sentryDsn })

// Firebase
try {
  firebase.initializeApp({
    credential: firebase.credential.cert(environment.firebaseCert),
  })
} catch (e) {
  console.error(new Date(), 'Failed to initialize admin, skipped')
}

// Express
const PORT = 4000
const app = express()
const httpServer = http.createServer(app)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])

/**
 * Middlewares
 */
app.use(helmet() as RequestHandler)
app.use(requestIp.mw())
app.use(cors(CORS_OPTIONS))

/**
 * Routes
 *
 */
// GraphQL
const server = routes.graphql(app)

// OAuth
app.use('/oauth', routes.oauth)

// Pay
app.use('/pay', routes.pay)

httpServer.listen(PORT, () => {
  console.log(
    `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`
  )
})
httpServer.setTimeout(SERVER_TIMEOUT)
