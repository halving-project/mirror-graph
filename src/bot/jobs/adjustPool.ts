import { getRepository } from 'typeorm'
import * as bluebird from 'bluebird'
import { errorHandler } from 'lib/error'
import * as logger from 'lib/logger'
import { getLatestBlockHeight } from 'lib/terra'
import { getPairPool } from 'lib/mirror'
import { assetService } from 'services'
import { BlockEntity, AssetPositionsEntity } from 'orm'
import config from 'config'

export async function getCollectedHeight(): Promise<number> {
  const latestBlockFromDB = await getRepository(BlockEntity)
    .findOne({ chainId: config.TERRA_CHAIN_ID }, { order: { id: 'DESC' } })

  return latestBlockFromDB?.height
}

export async function adjustPool(): Promise<void> {
  const latestHeight = await getLatestBlockHeight().catch(errorHandler)
  const collectedHeight = await getCollectedHeight()
  if (!latestHeight || !collectedHeight || latestHeight-collectedHeight > 1) {
    return
  }

  const assets = await assetService().getAll({ where: { isListed: true }})
  await bluebird.map(assets, async (asset) => {
    const pool = await getPairPool(asset.pair)

    if (asset.positions.pool !== pool.assetAmount) {
      logger.info(`adjust pool: ${asset.symbol}, ${asset.positions.pool} to ${pool.assetAmount}`)
      asset.positions.pool = pool.assetAmount
      await getRepository(AssetPositionsEntity).save(asset.positions)
    }
    if (asset.positions.uusdPool !== pool.collateralAmount) {
      logger.info(`adjust uusd pool: ${asset.symbol}, ${asset.positions.uusdPool} to ${pool.collateralAmount}`)
      asset.positions.uusdPool = pool.collateralAmount
      await getRepository(AssetPositionsEntity).save(asset.positions)
    }
  })
}
