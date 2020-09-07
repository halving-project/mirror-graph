import { KoaController, Get, Controller, Validate, Validator } from 'koa-joi-controllers'
import Container from 'typedi'
import { AssetService, PriceService } from 'services'
import { success } from 'endpoints'
import { ErrorTypes, HttpStatusCodes } from 'lib/error'
import { HistoryRanges } from 'types'

const Joi = Validator.Joi

@Controller('/assets')
export default class AssetController extends KoaController {
  get assetService(): AssetService {
    return Container.get(AssetService)
  }

  get priceService(): PriceService {
    return Container.get(PriceService)
  }

  @Get('/')
  async getAssets(ctx): Promise<void> {
    success(ctx, await this.assetService.getListedAssets())
  }

  @Get('/:symbol/history')
  @Validate({
    params: {
      symbol: Joi.string().required().min(4).max(10),
    },
    query: {
      range: Joi.string().required().valid(Object.values(HistoryRanges)),
    },
    failure: HttpStatusCodes[ErrorTypes.INVALID_REQUEST_ERROR],
  })
  async getAssetHistory(ctx): Promise<void> {
    const { symbol } = ctx.params
    const { range } = ctx.request.query

    const asset = await this.assetService.get({ symbol })

    success(ctx, await this.priceService.getHistory(asset, range))
  }
}