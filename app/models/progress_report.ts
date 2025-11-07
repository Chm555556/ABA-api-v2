import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'
import GoalProgress from './goal_progress.js'

export default class ProgressReport extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare generatedBy: number

  @column.date()
  declare startDate: DateTime

  @column.date()
  declare endDate: DateTime

  @column()
  declare overallSummary: string

  @column()
  declare recommendations: string

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => JSON.parse(value || '[]'),
  })
  declare graphData: any[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'generatedBy',
  })
  declare generator: BelongsTo<typeof User>

  @hasMany(() => GoalProgress, {
    foreignKey: 'progressReportId',
  })
  declare goals: HasMany<typeof GoalProgress>

  // Computed properties
  get reportPeriod() {
    return {
      startDate: this.startDate.toISODate(),
      endDate: this.endDate.toISODate(),
    }
  }
}