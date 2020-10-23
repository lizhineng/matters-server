import {
  SKIPPED_LIST_ITEM_TYPES,
  VERIFICATION_CODE_PROTECTED_TYPES,
  VERIFICATION_CODE_TYPES,
} from 'common/enums'
import {
  AuthenticationError,
  EmailExistsError,
  EmailNotFoundError,
  ForbiddenError,
} from 'common/errors'
import logger from 'common/logger'
import { isFeatureEnabled, resolveUrl } from 'common/utils'
import { gcp } from 'connectors'
import { MutationToSendVerificationCodeResolver } from 'definitions'

const resolver: MutationToSendVerificationCodeResolver = async (
  _,
  { input: { email: rawEmail, type, token, redirectUrl } },
  { viewer, dataSources: { userService, notificationService, systemService } }
) => {
  const email = rawEmail ? rawEmail.toLowerCase() : null

  if (!viewer.id && VERIFICATION_CODE_PROTECTED_TYPES.includes(type)) {
    throw new AuthenticationError(
      `visitor cannot send verification code of ${type}`
    )
  }

  if (redirectUrl) {
    redirectUrl = resolveUrl(redirectUrl)
  }

  let user

  // register check
  if (type === VERIFICATION_CODE_TYPES.register) {
    // check email
    user = await userService.findByEmail(email)
    if (user) {
      throw new EmailExistsError('email has been registered')
    }

    // check token for Turing test
    const isHuman = await gcp.recaptcha({ token, ip: viewer.ip })
    if (!isHuman) {
      throw new ForbiddenError('registration via scripting is not allowed')
    }
  }

  if (
    type === VERIFICATION_CODE_TYPES.payment_password_reset ||
    type === VERIFICATION_CODE_TYPES.password_reset ||
    type === VERIFICATION_CODE_TYPES.email_reset
  ) {
    user = await userService.findByEmail(email)
    if (!user) {
      throw new EmailNotFoundError('cannot find email')
    }
  }

  const { agentHash } = viewer
  const {
    AGENT_HASH: TYPE_HASH,
    EMAIL: TYPE_EMAIL,
    DOMAIN: TYPE_DOMAIN,
  } = SKIPPED_LIST_ITEM_TYPES

  const feature = await systemService.getFeatureFlag('fingerprint')
  const isFingerprintEnabled = feature && isFeatureEnabled(feature.flag, viewer)

  // verify email if it's in blocklist
  const banEmail = await systemService.findSkippedItem(TYPE_EMAIL, email)
  if (banEmail && banEmail.archived === false) {
    if (agentHash) {
      await systemService.createSkippedItem({
        type: TYPE_HASH,
        uuid: banEmail.uuid,
        value: agentHash,
      })
    }
    logger.info(new Error(`email ${email} is in blocklist`))

    if (isFingerprintEnabled) {
      return true
    }
  }

  // verify email doamin if it's in blocklist
  const domain = email.split('@')[1]
  const banDomain = await systemService.findSkippedItem(TYPE_DOMAIN, domain)
  if (banDomain && banDomain.archived === false) {
    logger.info(new Error(`domain ${domain} is in blocklist`))
    return true
  }

  // verify agent hash if it's in blocklist
  if (agentHash) {
    const banAgentHash = await systemService.findSkippedItem(
      TYPE_HASH,
      agentHash
    )
    if (banAgentHash && banAgentHash.archived === false) {
      await systemService.createSkippedItem({
        type: TYPE_EMAIL,
        uuid: banAgentHash.uuid,
        value: email,
      })
      logger.info(new Error(`agent hash ${agentHash} is in blocklist`))

      if (isFingerprintEnabled) {
        return true
      }
    }
  }

  // insert record
  const { code } = await userService.createVerificationCode({
    userId: viewer.id,
    email,
    type,
    strong: !!redirectUrl, // strong random code for link
  })

  // send verification email
  notificationService.mail.sendVerificationCode({
    to: email,
    type,
    code,
    redirectUrl,
    recipient: {
      displayName: user && user.displayName,
    },
    language: viewer.language,
  })

  return true
}

export default resolver
