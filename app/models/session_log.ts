import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Client from './client.js'
import User from './user.js'
import BehaviorData from './behavior_data.js'
import Incident from './incident.js'

export default class SessionLog extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare clientId: number

  @column()
  declare rbtId: number

  @column()
  declare bcbaId: number

  @column.date()
  declare date: DateTime

  @column()
  declare startTime: string

  @column()
  declare endTime: string

  @column()
  declare duration: number

  @column()
  declare totalHours: number

  @column()
  declare cptCode: string

  @column()
  declare serviceType: string

  @column()
  declare location: 'clinic' | 'home' | 'school' | 'community'

  @column()
  declare sessionNotes: string | null

  @column()
  declare rbtSignature: string

  @column()
  declare parentSignature: string | null

  @column()
  declare status: 'draft' | 'submitted' | 'bcba_approved' | 'clinic_approved' | 'approved' | 'rejected'

  @column()
  declare bcbaApproved: boolean

  @column()
  declare bcbaApprovedBy: number | null

  @column.dateTime()
  declare bcbaApprovedAt: DateTime | null

  @column()
  declare bcbaNotes: string | null

  @column()
  declare clinicApproved: boolean

  @column()
  declare clinicApprovedBy: number | null

  @column.dateTime()
  declare clinicApprovedAt: DateTime | null

  @column()
  declare clinicNotes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  @belongsTo(() => User, {
    foreignKey: 'rbtId',
  })
  declare rbt: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'bcbaId',
  })
  declare bcba: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'bcbaApprovedBy',
  })
  declare bcbaApprover: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'clinicApprovedBy',
  })
  declare clinicApprover: BelongsTo<typeof User>

  @hasMany(() => BehaviorData)
  declare behaviorData: HasMany<typeof BehaviorData>

  @hasMany(() => Incident)
  declare incidents: HasMany<typeof Incident>

  // Computed properties
  get clientName() {
    return this.client?.fullName || ''
  }

  get rbtName() {
    return this.rbt?.name || ''
  }

  get assignedBcba() {
    return this.bcba?.name || ''
  }

  get bcbaApproval() {
    if (!this.bcbaApproved) return null
    
    return {
      approved: this.bcbaApproved,
      approvedBy: this.bcbaApprovedBy,
      approvedAt: this.bcbaApprovedAt?.toISO(),
      notes: this.bcbaNotes,
    }
  }

  get clinicApproval() {
    if (!this.clinicApproved) return null
    
    return {
      approved: this.clinicApproved,
      approvedBy: this.clinicApprovedBy,
      approvedAt: this.clinicApprovedAt?.toISO(),
      notes: this.clinicNotes,
    }
  }
}