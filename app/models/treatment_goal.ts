import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'
import BehaviorData from './behavior_data.js'
import GoalProgress from './goal_progress.js'
import BaselineData from './baseline_data.js'

export default class TreatmentGoal extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare title: string

  @column()
  declare description: string

  @column()
  declare targetBehavior: string

  @column()
  declare measurementType: 'frequency' | 'duration' | 'percentage' | 'trials'

  @column()
  declare masteryCriteria: string

  @column()
  declare status: 'active' | 'mastered' | 'discontinued'

  @column()
  declare domain: string | null

  @column({
    prepare: (value: string[] | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | null) => {
      if (!value) return null
      try {
        return JSON.parse(value)
      } catch (error) {
        // If it's not valid JSON, treat it as comma-separated string
        if (typeof value === 'string' && value.includes(',')) {
          return value.split(',').map((item: string) => item.trim())
        } else if (typeof value === 'string') {
          // Single item, wrap in array
          return [value.trim()]
        }
        return null
      }
    },
  })
  declare promptHierarchy: string[] | null

  @column()
  declare baselineScore: number | null

  @column()
  declare baselineTrials: number | null

  @column()
  declare targetPercentage: number | null

  @column()
  declare consecutiveSessions: number | null

  @column()
  declare goalPhase: 'baseline' | 'acquisition' | 'maintenance' | 'mastered' | 'discontinued'

  @column()
  declare createdBy: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'createdBy',
  })
  declare creator: BelongsTo<typeof User>

  @hasMany(() => BehaviorData, {
    foreignKey: 'goalId',
  })
  declare behaviorData: HasMany<typeof BehaviorData>

  @hasMany(() => GoalProgress, {
    foreignKey: 'goalId',
  })
  declare goalProgress: HasMany<typeof GoalProgress>

  @hasMany(() => BaselineData, {
    foreignKey: 'goalId',
  })
  declare baselineData: HasMany<typeof BaselineData>
}