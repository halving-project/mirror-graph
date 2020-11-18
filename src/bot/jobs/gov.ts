import { Coins, MsgExecuteContract } from '@terra-money/terra.js'
import { TxWallet, getLatestBlockHeight } from 'lib/terra'
import { getGovPolls, getGovConfig } from 'lib/mirror'
import { toSnakeCase } from 'lib/caseStyles'
import * as logger from 'lib/logger'
import { govService } from 'services'
import { Updater } from 'lib/Updater'

const updater = new Updater(5 * 60000) // 5mins

export async function updatePolls(wallet: TxWallet): Promise<void> {
  if (!updater.needUpdate(Date.now())) {
    return
  }

  const latestHeight = await getLatestBlockHeight()
  if (!latestHeight)
    return

  const { gov } = govService().get()
  const sender = wallet.key.accAddress
  const { effectiveDelay, expirationPeriod } = await getGovConfig(gov)
  const msgs = []

  // collect ended poll
  let polls = await getGovPolls(gov, 'in_progress', 100)
  polls.map((poll) => {
    if (latestHeight > poll.endHeight) {
      msgs.push(new MsgExecuteContract(
        sender, gov, toSnakeCase({ endPoll: { pollId: poll.id } }), new Coins([])
      ))

      logger.info(`end poll id: ${poll.id}`)
    }
  })

  // collect execute needed
  polls = await getGovPolls(gov, 'passed', 100)
  polls.map((poll) => {
    const executeHeight = poll.endHeight + effectiveDelay
    // try execute only 1 hour(600 blocks)
    if (latestHeight > executeHeight && latestHeight - executeHeight < 10 * 60 ) {
      msgs.push(new MsgExecuteContract(
        sender, gov, toSnakeCase({ executePoll: { pollId: poll.id } }), new Coins([])
      ))

      logger.info(`execute poll id: ${poll.id}`)
    }

    // over expiration period, expire
    const expireHeight = poll.endHeight + expirationPeriod
    if (latestHeight > expireHeight) {
      msgs.push(new MsgExecuteContract(
        sender, gov, toSnakeCase({ expirePoll: { pollId: poll.id } }), new Coins([])
      ))

      logger.info(`expire poll id: ${poll.id}`)
    }
  })

  if (msgs.length > 0) {
    await wallet.executeMsgs(msgs)
  }

  logger.info('gov polls updated')
}
