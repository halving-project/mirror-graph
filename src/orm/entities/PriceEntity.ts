import {
  Column,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm'
import { AssetEntity } from 'orm'

@Entity('price')
@Index('index_price_symbol_and_datetime_and_asset', ['symbol', 'datetime', 'asset'], {
  unique: true,
})
export class PriceEntity {
  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @PrimaryGeneratedColumn()
  id: number

  @Column()
  symbol: string

  @Column()
  datetime: Date

  @Column('decimal', { precision: 40, scale: 6 })
  open: string

  @Column('decimal', { precision: 40, scale: 6 })
  high: string

  @Column('decimal', { precision: 40, scale: 6 })
  low: string

  @Column('decimal', { precision: 40, scale: 6 })
  close: string

  @Column('decimal', { precision: 40, scale: 6, default: '1' })
  priceMultiplier: string

  @ManyToOne(() => AssetEntity, { onDelete: 'CASCADE' })
  @JoinColumn()
  asset: AssetEntity
}
