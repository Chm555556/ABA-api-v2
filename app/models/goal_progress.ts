import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ProgressReport from './progress_report.js'
import TreatmentGoal from './treatment_goal.js'

export default class GoalProgress extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare progressReportId: number

  @column()
  declare goalId: number

  @column()
  declare currentLevel: number

  @column()
  declare targetLevel: number

  @column()
  declare progress: 'improving' | 'maintaining' | 'regressing'

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => ProgressReport, {
    foreignKey: 'progressReportId',
  })
  declare progressReport: BelongsTo<typeof ProgressReport>

  @belongsTo(() => TreatmentGoal, {
    foreignKey: 'goalId',
  })
  declare goal: BelongsTo<typeof TreatmentGoal>

  // Computed properties
  get goalTitle() {
    return this.goal?.title || ''
  }
}