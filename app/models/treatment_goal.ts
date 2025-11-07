import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'
import BehaviorData from './behavior_data.js'
import GoalProgress from './goal_progress.js'

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
}