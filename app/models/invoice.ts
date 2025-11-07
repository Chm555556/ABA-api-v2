import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'
import Clinic from './clinic.js'
import Claim from './claim.js'

export default class Invoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare rbtId: number

  @column()
  declare bcbaId: number

  @column()
  declare clinicId: number

  @column({
    prepare: (value: number[]) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value || '[]'),
  })
  declare sessionIds: number[]

  @column.date()
  declare periodStart: DateTime

  @column.date()
  declare periodEnd: DateTime

  @column()
  declare sessionCount: number

  @column()
  declare totalHours: number

  @column()
  declare amount: number

  @column()
  declare status: 'draft' | 'submitted' | 'paid' | 'rejected'

  @column.dateTime()
  declare submittedAt: DateTime | null

  @column.dateTime()
  declare paidAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
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

  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @hasMany(() => Claim)
  declare claims: HasMany<typeof Claim>
}