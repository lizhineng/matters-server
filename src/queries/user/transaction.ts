import type {
  GQLTransactionResolvers,
  TransactionTargetType,
  GQLTransactionPurpose,
} from 'definitions'

import { camelCase } from 'lodash'

import {
  BLOCKCHAIN_CHAINNAME,
  NODE_TYPES,
  PAYMENT_PROVIDER,
} from 'common/enums'
import { ServerError } from 'common/errors'
import { toGlobalId } from 'common/utils'

export const Transaction: GQLTransactionResolvers = {
  id: ({ id }) => toGlobalId({ type: NODE_TYPES.Transaction, id }),
  fee: ({ fee }) => +fee || 0,
  purpose: ({ purpose }) => camelCase(purpose) as GQLTransactionPurpose,
  sender: (trx, _, { dataSources: { userService } }) =>
    trx.senderId ? userService.loadById(trx.senderId) : null,
  recipient: (trx, _, { dataSources: { userService } }) =>
    trx.recipientId ? userService.loadById(trx.recipientId) : null,
  blockchainTx: async (trx, _, { dataSources: { paymentService } }) => {
    if (trx.provider !== PAYMENT_PROVIDER.blockchain) {
      return null
    }
    const blockchainTx = await paymentService.findBlockchainTransactionById(
      trx.providerTxId
    )
    const chain =
      BLOCKCHAIN_CHAINNAME[
        parseInt(blockchainTx.chainId, 10) as keyof typeof BLOCKCHAIN_CHAINNAME
      ]
    if (!chain) {
      throw new ServerError('chain is not supported')
    }
    return {
      chain,
      txHash: blockchainTx.txHash,
    }
  },
  target: async (
    trx,
    _,
    { dataSources: { articleService, atomService, paymentService } }
  ) => {
    if (!trx.targetId || !trx.targetType) {
      return null
    }

    const tableTypeMap = {
      article: 'Article',
      circle_price: 'Circle',
      transaction: 'Transaction',
    }

    const { table } = (await atomService.findFirst({
      table: 'entity_type',
      where: { id: trx.targetType },
    })) as { table: keyof typeof tableTypeMap }

    let target
    switch (table) {
      case 'article': {
        target = await articleService.draftLoader.load(trx.targetId)
        break
      }
      case 'circle_price': {
        const price = await atomService.findUnique({
          table: 'circle_price',
          where: { id: trx.targetId },
        })
        target = await atomService.findUnique({
          table: 'circle',
          where: { id: price?.circleId },
        })
        break
      }
      case 'transaction': {
        target = await paymentService.dataloader.load(trx.targetId)
        break
      }
    }

    return {
      ...target,
      __type: tableTypeMap[table],
    }
  },
}

export const TransactionTarget = {
  __resolveType: ({ __type }: { __type: TransactionTargetType }) => __type,
}
