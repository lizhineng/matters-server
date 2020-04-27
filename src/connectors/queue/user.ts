import Queue from 'bull'

import {
  MINUTE,
  QUEUE_JOB,
  QUEUE_NAME,
  QUEUE_PRIORITY,
  USER_STATE,
} from 'common/enums'
import logger from 'common/logger'

import { BaseQueue } from './baseQueue'

interface ArchiveUserData {
  userId: string
}

class UserQueue extends BaseQueue {
  constructor() {
    super(QUEUE_NAME.user)
    this.addConsumers()
  }

  /**
   * Producers
   */
  addRepeatJobs = async () => {
    // activate onboarding users every 2 minutes
    this.q.add(
      QUEUE_JOB.activateOnboardingUsers,
      {},
      {
        priority: QUEUE_PRIORITY.MEDIUM,
        repeat: {
          every: MINUTE * 2, // every 2 minutes
        },
      }
    )

    // unban user every day at 00:00
    this.q.add(
      QUEUE_JOB.unbanUsers,
      {},
      {
        priority: QUEUE_PRIORITY.MEDIUM,
        repeat: { cron: '0 0 * * *', tz: 'Asia/Hong_Kong' },
      }
    )
  }

  /**
   * Producers
   */
  archiveUser = (data: ArchiveUserData) => {
    return this.q.add(QUEUE_JOB.archiveUser, data, {
      priority: QUEUE_PRIORITY.NORMAL,
      attempts: 1,
    })
  }

  /**
   * Cusumers
   */
  private addConsumers = () => {
    this.q.process(QUEUE_JOB.archiveUser, this.handleArchiveUser)

    // activate onboarding users
    this.q.process(
      QUEUE_JOB.activateOnboardingUsers,
      this.activateOnboardingUsers
    )

    this.q.process(QUEUE_JOB.unbanUsers, this.unbanUsers)
  }

  private handleArchiveUser: Queue.ProcessCallbackFunction<unknown> = async (
    job,
    done
  ) => {
    try {
      const { userId } = job.data as ArchiveUserData

      // delete unlinked drafts
      await this.deleteUnlinkedDrafts(userId)
      job.progress(50)

      // delete assets
      await this.deleteUserAssets(userId)
      job.progress(100)

      done(null, { userId })
    } catch (e) {
      done(e)
    }
  }

  /**
   * Delete drafts that aren't linked to articles
   */
  private deleteUnlinkedDrafts = async (authorId: string) => {
    const drafts = await this.draftService.findUnlinkedDraftsByAuthor(authorId)
    const {
      id: draftEntityTypeId,
    } = await this.systemService.baseFindEntityTypeId('draft')

    // delete assets
    await Promise.all(
      drafts.map(async (draft) => {
        const assetMap = await this.systemService.findAssetMap(
          draftEntityTypeId,
          draft.id
        )
        const assets = assetMap.reduce((data: any, asset: any) => {
          data[`${asset.assetId}`] = asset.path
          return data
        }, {})

        if (assets && Object.keys(assets).length > 0) {
          await this.systemService.deleteAssetAndAssetMap(assets)
        }
      })
    )

    // delete drafts
    await this.draftService.baseBatchDelete(drafts.map((draft) => draft.id))
  }

  /**
   * Delete user assets:
   * - avatar
   * - profileCover
   * - oauthClientAvatar
   *
   */
  private deleteUserAssets = async (userId: string) => {
    const types = ['avatar', 'profileCover', 'oauthClientAvatar']
    const assets = (
      await this.systemService.findAssetsByAuthorAndTypes(userId, types)
    ).reduce((data: any, asset: any) => {
      data[`${asset.id}`] = asset.path
      return data
    }, {})

    if (assets && Object.keys(assets).length > 0) {
      await this.systemService.deleteAssetAndAssetMap(assets)
    }
  }

  /**
   * Activate onboarding users
   */
  private activateOnboardingUsers: Queue.ProcessCallbackFunction<
    unknown
  > = async (job, done) => {
    try {
      const activatableUsers = await this.userService.findActivatableUsers()
      const activatedUsers: Array<string | number> = []

      await Promise.all(
        activatableUsers.map(async (user, index) => {
          try {
            await this.userService.activate({ id: user.id })
            this.notificationService.trigger({
              event: 'user_activated',
              recipientId: user.id,
            })
            activatedUsers.push(user.id)
            job.progress(((index + 1) / activatableUsers.length) * 100)
          } catch (e) {
            logger.error(e)
          }
        })
      )

      done(null, activatedUsers)
    } catch (e) {
      done(e)
    }
  }

  /**
   * Unban users.
   */
  private unbanUsers: Queue.ProcessCallbackFunction<unknown> = async (
    job,
    done
  ) => {
    try {
      const records = await this.userService.findPunishRecordsByTime({
        state: USER_STATE.banned,
        archived: false,
        expiredAt: new Date(Date.now()).toISOString(),
      })
      const users: Array<string | number> = []

      await Promise.all(
        records.map(async (record, index) => {
          try {
            await this.userService.updateInfo(record.userId, {
              state: USER_STATE.active,
            })
            await this.userService.baseUpdate(
              record.id,
              { archived: true },
              'punish_record'
            )
            this.notificationService.trigger({
              event: 'user_unbanned',
              recipientId: record.userId,
            })
            users.push(record.userId)
            job.progress(((index + 1) / records.length) * 100)
          } catch (e) {
            logger.error(e)
          }
        })
      )

      done(null, users)
    } catch (e) {
      done(e)
    }
  }
}

export const userQueue = new UserQueue()
