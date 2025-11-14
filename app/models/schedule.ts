import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'

export default class Schedule extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare rbtId: number

  @column()
  declare bcbaId: number

  @column.date()
  declare date: DateTime

  @column()
  declare startTime: string

  @column()
  declare endTime: string

  @column()
  declare location: string

  @column()
  declare status: string

  @column()
  declare notes: string | null

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

  // Computed properties
  get clientName() {
    return this.client?.fullName || ''
  }

  get therapistName() {
    return this.rbt?.name || ''
  }

  get time() {
    return `${this.startTime} - ${this.endTime}`
  }
}