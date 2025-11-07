import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'

export default class ClientDocument extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare name: string

  @column()
  declare type: 'consent' | 'medical' | 'assessment' | 'report' | 'other'

  @column()
  declare url: string

  @column()
  declare uploadedBy: number

  @column.dateTime()
  declare uploadedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'uploadedBy',
  })
  declare uploader: BelongsTo<typeof User>
}