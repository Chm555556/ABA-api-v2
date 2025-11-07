import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BehaviorData from './behavior_data.js'

export default class Trial extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare behaviorDataId: number

  @column()
  declare prompt: string

  @column()
  declare response: 'correct' | 'incorrect' | 'prompted' | 'no_response'

  @column()
  declare reinforcement: string | null

  @column()
  declare notes: string | null

  @column.dateTime()
  declare timestamp: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => BehaviorData, {
    foreignKey: 'behaviorDataId',
  })
  declare behaviorData: BelongsTo<typeof BehaviorData>
}