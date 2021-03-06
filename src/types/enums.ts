import { registerEnumType } from 'type-graphql'

export enum AssetStatus {
  NONE = 'NONE',
  LISTED = 'LISTED',
  DELISTED = 'DELISTED',
}

registerEnumType(AssetStatus, { name: 'AssetStatus' })
