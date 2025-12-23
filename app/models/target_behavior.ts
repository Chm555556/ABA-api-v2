import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TreatmentGoal from './treatment_goal.js'
import User from './user.js'

export default class TargetBehavior extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare goalId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare baselinePercentage: number | null

  @column()
  declare intensity: 'low' | 'moderate' | 'high' | 'severe'

  @column()
  declare notes: string | null

  @column()
  declare status: 'active' | 'mastered' | 'discontinued' | 'on_hold'

  @column()
  declare currentPercentage: number | null

  @column.date()
  declare masteryDate: DateTime | null

  @column()
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => TreatmentGoal, {
    foreignKey: 'goalId',
  })
  declare goal: BelongsTo<typeof TreatmentGoal>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>
}