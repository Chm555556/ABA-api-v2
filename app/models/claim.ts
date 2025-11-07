import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Invoice from './invoice.js'
import Client from './client.js'
import User from './user.js'

export default class Claim extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare invoiceId: number

  @column()
  declare clientId: number

  @column()
  declare rbtId: number

  @column()
  declare bcbaId: number

  @column()
  declare clearinghouse: string

  @column()
  declare claimNumber: string

  @column()
  declare amount: number

  @column()
  declare status: 'submitted' | 'accepted' | 'rejected' | 'paid'

  @column.dateTime()
  declare submittedAt: DateTime

  @column.dateTime()
  declare responseAt: DateTime | null

  @column.dateTime()
  declare paidAt: DateTime | null

  @column()
  declare rejectionReason: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Invoice)
  declare invoice: BelongsTo<typeof Invoice>

  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'rbtId',
  })
  declare rbt: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'bcbaId',
  })
  declare bcba: BelongsTo<typeof User>
}