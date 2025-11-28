import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Clinic from './clinic.js'
import User from './user.js'
import TreatmentGoal from './treatment_goal.js'
import SessionLog from './session_log.js'
import ClientDocument from './client_document.js'
import Schedule from './schedule.js'
import ProgressReport from './progress_report.js'

export default class Client extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare firstName: string

  @column()
  declare lastName: string

  @column.date()
  declare dateOfBirth: DateTime



  @column()
  declare street: string

  @column()
  declare city: string

  @column()
  declare state: string

  @column()
  declare zipCode: string

  @column()
  declare phone: string

  @column()
  declare email: string

  @column()
  declare emergencyContactName: string

  @column()
  declare emergencyContactRelationship: string

  @column()
  declare emergencyContactPhone: string

  @column()
  declare insuranceType: 'insurance' | 'private' | 'regional'

  @column()
  declare insuranceId: string

  @column()
  declare clinicId: number

  @column()
  declare assignedBcba: number | null

  @column()
  declare parentId: number | null

  @column()
  declare status: 'active' | 'inactive' | 'discharged'

  @column.date()
  declare admissionDate: DateTime

  @column.date()
  declare dischargeDate: DateTime | null

  @column({
    prepare: (value: string[] | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | null) => {
      if (!value) return []
      try {
        return JSON.parse(value)
      } catch (error) {
        // If it's not valid JSON, treat it as a single diagnosis string
        return [value]
      }
    },
  })
  declare diagnosis: string[] | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => User, {
    foreignKey: 'assignedBcba',
  })
  declare bcba: BelongsTo<typeof User>

  @manyToMany(() => User, {
    pivotTable: 'client_rbts',
    localKey: 'id',
    pivotForeignKey: 'client_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'rbt_id',
    pivotTimestamps: {
      createdAt: 'assigned_at',
      updatedAt: false,
    },
  })
  declare assignedRbts: ManyToMany<typeof User>

  @hasMany(() => TreatmentGoal)
  declare treatmentGoals: HasMany<typeof TreatmentGoal>

  @hasMany(() => SessionLog)
  declare sessionLogs: HasMany<typeof SessionLog>

  @hasMany(() => ClientDocument)
  declare documents: HasMany<typeof ClientDocument>

  @hasMany(() => Schedule)
  declare schedules: HasMany<typeof Schedule>

  @hasMany(() => ProgressReport)
  declare progressReports: HasMany<typeof ProgressReport>

  // Computed properties
  get fullName() {
    return `${this.firstName} ${this.lastName}`
  }

  get name() {
    return this.fullName
  }

  get address() {
    return {
      street: this.street,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
    }
  }

  get emergencyContact() {
    return {
      name: this.emergencyContactName,
      relationship: this.emergencyContactRelationship,
      phone: this.emergencyContactPhone,
    }
  }

  get age() {
    const today = DateTime.now()
    const birthDate = this.dateOfBirth
    return Math.floor(today.diff(birthDate, 'years').years)
  }
}