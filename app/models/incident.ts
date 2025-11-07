import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SessionLog from './session_log.js'

export default class Incident extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare type: 'behavior' | 'injury' | 'property' | 'other'

  @column()
  declare severity: 'low' | 'medium' | 'high'

  @column()
  declare description: string

  @column()
  declare actionTaken: string

  @column.dateTime()
  declare timestamp: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => SessionLog, {
    foreignKey: 'sessionId',
  })
  declare session: BelongsTo<typeof SessionLog>
}