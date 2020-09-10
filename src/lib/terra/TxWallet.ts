import {
  Wallet,
  Key,
  Coins,
  TxInfo,
  Msg,
  MsgStoreCode,
  MsgInstantiateContract,
  MsgExecuteContract,
} from '@terra-money/terra.js'
import * as fs from 'fs'
import * as logger from 'lib/logger'
import { toSnakeCase } from 'lib/caseStyles'
import { lcd, transaction } from './lcd'

export class TxWallet extends Wallet {
  private managedSequence
  private managedAccountNumber

  constructor(key: Key) {
    super(lcd, key)
  }

  async transaction(msgs: Msg[], timeout = 60000): Promise<TxInfo> {
    if (!this.managedAccountNumber && !this.managedSequence) {
      const { account_number: accountNumber, sequence } = await this.accountNumberAndSequence()

      this.managedAccountNumber = accountNumber
      this.managedSequence = sequence
    }

    return transaction(this, msgs, this.managedAccountNumber, this.managedSequence, timeout).then(
      (txInfo) => {
        this.managedSequence += 1
        return txInfo
      }
    )
  }

  async storeCode(path: string): Promise<number> {
    const wasmBinary = fs.readFileSync(path)

    const tx = await this.transaction([
      new MsgStoreCode(this.key.accAddress, wasmBinary.toString('base64')),
    ])

    if (tx.code) {
      throw new Error(`[${tx.code}] ${tx.raw_log}`)
    }

    try {
      const codeId = +tx.logs[0].events[1].attributes[1].value
      logger.info(`stored ${path}, codeId: ${codeId}`)
      return codeId
    } catch (error) {
      logger.error(`failed store code ${path}`)
      throw new Error(tx.raw_log)
    }
  }

  async instantiate(codeId: number, initMsg: object, migratable = true): Promise<string> {
    const tx = await this.transaction(
      [
        new MsgInstantiateContract(
          this.key.accAddress,
          codeId,
          toSnakeCase(initMsg),
          new Coins([]),
          migratable
        ),
      ],
      300000
    )

    if (tx.code) {
      throw new Error(`[${tx.code}] ${tx.raw_log}`)
    }

    try {
      const contractAddress = tx.logs[0].events[0].attributes[2].value

      logger.info(`instantiated code ${codeId}, address: ${contractAddress}`)

      return contractAddress
    } catch (error) {
      logger.error(`failed instantiate code ${codeId}`)
      logger.error(tx.raw_log)
      throw new Error(error)
    }
  }

  async executeMsgs(msgs: Msg[]): Promise<TxInfo> {
    const tx = await this.transaction(msgs)

    if (tx.code) {
      throw new Error(`[${tx.code}] ${tx.raw_log}`)
    }

    try {
      if (!tx.logs[0].events[0].attributes[0].value) {
        throw new Error('execute contract failed')
      }

      return tx
    } catch (error) {
      logger.error(tx.raw_log)
      throw new Error(error)
    }
  }

  async execute(
    contractAddress: string,
    msg: object,
    coins: Coins = new Coins([])
  ): Promise<TxInfo> {
    return this.executeMsgs([
      new MsgExecuteContract(this.key.accAddress, contractAddress, toSnakeCase(msg), coins),
    ])
  }
}
