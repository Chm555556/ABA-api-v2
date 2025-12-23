import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TreatmentGoal from './treatment_goal.js'
import User from './user.js'

export default class BaselineData extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare goalId: number

  @column()
  declare score: number

  @column()
  declare trials: number | null

  @column.date()
  declare collectionDate: DateTime

  @column()
  declare notes: string | null

  @column()
  declare collectedBy: number | null

  // Enhanced session tracking
  @column()
  declare sessionNumber: number | null

  @column()
  declare sessionType: string | null

  @column()
  declare sessionNotes: string | null

  @column()
  declare totalTrialsInSession: number | null

  @column()
  declare sessionDurationMinutes: number | null

  @column()
  declare environment: string | null

  @column({
    prepare: (value: any) => value ? JSON.stringify(value) : null,
    consume: (value: string | null) => {
      if (!value) return null
      try {
        return JSON.parse(value)
      } catch (error) {
        return null
      }
    },
  })
  declare trialDetails: any | null

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
    foreignKey: 'collectedBy',
  })
  declare collector: BelongsTo<typeof User>
}