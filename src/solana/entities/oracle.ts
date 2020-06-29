import * as BufferLayout from 'buffer-layout'
import { Account, PublicKey, Connection, Transaction, SystemProgram } from '@solana/web3.js'
import { sendTransaction, Amount, SymbolBuffer } from 'solana'
import * as Layout from 'solana/types/layout'

/**
 * Information about a mint config
 */
export type OracleInfo = {
  price: Amount
  decimals: number
  assetToken: PublicKey
  baseToken: PublicKey
  symbol: SymbolBuffer
  owner: PublicKey
}

/**
 * @private
 */
const OracleInfoLayout = BufferLayout.struct([
  Layout.uint64('state'),
  Layout.uint64('price'),
  Layout.uint64('decimals'),
  Layout.publicKey('assetToken'),
  Layout.publicKey('baseToken'),
  Layout.symbol('symbol'),
  Layout.publicKey('owner'),
])

/**
 * Simple Oracle
 */
export class Oracle {
  /**
   * @private
   */
  connection: Connection

  oracle: PublicKey
  owner: Account
  programId: PublicKey

  /**
   * Create a Token object attached to the specific oracle
   *
   * @param connection The connection to use
   * @param oracle Public key
   * @param oracle programId
   */
  constructor(connection: Connection, oracle: PublicKey, owner: Account, programId: PublicKey) {
    Object.assign(this, { connection, oracle, owner, programId })
  }

  /**
   * Get the minimum balance for the oracle to be rent exempt
   *
   * @return Number of lamports required
   */
  static async getMinBalanceRentForExemptOracle(connection: Connection): Promise<number> {
    return connection.getMinimumBalanceForRentExemption(OracleInfoLayout.span)
  }

  static async createOracle(
    connection: Connection,
    oracleAccount: Account,
    owner: Account,
    assetToken: PublicKey,
    baseToken: PublicKey,
    decimals: number,
    symbol: SymbolBuffer,
    programId: PublicKey
  ): Promise<Oracle> {
    const oracle = new Oracle(connection, oracleAccount.publicKey, owner, programId)

    let transaction: Transaction = null

    const dataLayout = BufferLayout.struct([
      BufferLayout.nu64('instruction'),
      Layout.uint64('decimals'),
      Layout.symbol('symbol'),
    ])

    let data = Buffer.alloc(1024)
    {
      const encodeLength = dataLayout.encode(
        {
          instruction: 0,
          decimals: new Amount(decimals).toBuffer(),
          symbol: symbol.toBuffer(),
        },
        data
      )
      data = data.slice(0, encodeLength)
    }

    const balanceNeeded = await Oracle.getMinBalanceRentForExemptOracle(connection)

    // Allocate memory for the oracleAccount account
    transaction = SystemProgram.createAccount({
      fromPubkey: owner.publicKey,
      newAccountPubkey: oracleAccount.publicKey,
      lamports: balanceNeeded,
      space: OracleInfoLayout.span,
      programId: programId,
    })

    await sendTransaction(connection, transaction, owner, oracleAccount)

    transaction = new Transaction().add({
      keys: [
        { pubkey: owner.publicKey, isSigner: true, isWritable: false },
        { pubkey: assetToken, isSigner: false, isWritable: false },
        { pubkey: baseToken, isSigner: false, isWritable: false },
        { pubkey: oracleAccount.publicKey, isSigner: false, isWritable: true },
      ],
      programId,
      data,
    })

    await sendTransaction(connection, transaction, owner)

    return oracle
  }

  async updatePrice(price: Amount): Promise<void> {
    let transaction: Transaction = null

    const dataLayout = BufferLayout.struct([
      BufferLayout.nu64('instruction'),
      Layout.uint64('price'),
    ])

    let data = Buffer.alloc(1024)
    {
      const encodeLength = dataLayout.encode(
        {
          instruction: 1,
          price: price.toBuffer(),
        },
        data
      )
      data = data.slice(0, encodeLength)
    }

    transaction = new Transaction().add({
      keys: [
        { pubkey: this.owner.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.oracle, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data,
    })

    await sendTransaction(this.connection, transaction, this.owner)

    return
  }

  /**
   * Retrieve oracle information
   */
  async oracleInfo(): Promise<OracleInfo> {
    const accountInfo = await this.connection.getAccountInfo(this.oracle)
    if (accountInfo == null) {
      throw new Error('failed to retrieve oracle info')
    }

    if (!accountInfo.owner.equals(this.programId)) {
      throw new Error(`Invalid oracle owner: ${JSON.stringify(accountInfo.owner)}`)
    }

    const data = Buffer.from(accountInfo.data)
    const oracleInfo = OracleInfoLayout.decode(data)
    oracleInfo.state = Number(oracleInfo.state[0])
    if (oracleInfo.state !== 1) {
      throw new Error('Invalid oracle account data')
    }

    oracleInfo.symbol = SymbolBuffer.fromBuffer(oracleInfo.symbol)
    oracleInfo.decimals = Amount.fromBuffer(oracleInfo.decimals).toNumber()
    oracleInfo.price = Amount.fromBuffer(oracleInfo.price)
    return oracleInfo
  }
}