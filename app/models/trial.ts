import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BehaviorData from './behavior_data.js'
import SessionLog from './session_log.js'
import TreatmentGoal from './treatment_goal.js'

export default class Trial extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare behaviorDataId: number | null

  // Direct session and goal relationships for real-time recording
  @column()
  declare sessionId: number | null

  @column()
  declare goalId: number | null

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

  // Enhanced fields for detailed trial tracking
  @column()
  declare durationSeconds: number | null

  @column()
  declare antecedent: string | null

  @column()
  declare consequence: string | null

  // Enhanced trial tracking
  @column()
  declare promptType: string | null

  @column()
  declare promptLevel: number | null

  @column()
  declare independent: boolean

  @column()
  declare errorCorrection: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => BehaviorData, {
    foreignKey: 'behaviorDataId',
  })
  declare behaviorData: BelongsTo<typeof BehaviorData>

  @belongsTo(() => SessionLog, {
    foreignKey: 'sessionId',
  })
  declare session: BelongsTo<typeof SessionLog>

  @belongsTo(() => TreatmentGoal, {
    foreignKey: 'goalId',
  })
  declare goal: BelongsTo<typeof TreatmentGoal>
}