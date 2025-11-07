import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import SessionLog from './session_log.js'
import TreatmentGoal from './treatment_goal.js'
import Trial from './trial.js'

export default class BehaviorData extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare goalId: number

  @column()
  declare correct: number

  @column()
  declare incorrect: number

  @column()
  declare prompted: number

  @column()
  declare total: number

  @column()
  declare percentage: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => SessionLog, {
    foreignKey: 'sessionId',
  })
  declare session: BelongsTo<typeof SessionLog>

  @belongsTo(() => TreatmentGoal, {
    foreignKey: 'goalId',
  })
  declare goal: BelongsTo<typeof TreatmentGoal>

  @hasMany(() => Trial, {
    foreignKey: 'behaviorDataId',
  })
  declare trials: HasMany<typeof Trial>

  // Computed properties
  get goalTitle() {
    return this.goal?.title || ''
  }

  get summary() {
    return {
      correct: this.correct,
      incorrect: this.incorrect,
      prompted: this.prompted,
      total: this.total,
      percentage: this.percentage,
    }
  }
}