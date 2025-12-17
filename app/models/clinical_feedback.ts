import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Client from './client.js'
import SessionLog from './session_log.js'

export default class ClinicalFeedback extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sessionId: number

  @column()
  declare patientId: number

  @column()
  declare clinicianId: number

  @column.date()
  declare date: DateTime

  @column()
  declare categoryScores: string // JSON string of category scores

  @column()
  declare overallScore: number

  @column()
  declare engagementLevel: number

  @column()
  declare riskFactors: string // JSON string of risk factors array

  @column()
  declare comments: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => SessionLog, {
    foreignKey: 'sessionId',
  })
  declare session: BelongsTo<typeof SessionLog>

  @belongsTo(() => Client, {
    foreignKey: 'patientId',
  })
  declare patient: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'clinicianId',
  })
  declare clinician: BelongsTo<typeof User>

  // Computed properties
  get parsedCategoryScores() {
    try {
      return JSON.parse(this.categoryScores)
    } catch {
      return {}
    }
  }

  get parsedRiskFactors() {
    try {
      return JSON.parse(this.riskFactors)
    } catch {
      return []
    }
  }
}