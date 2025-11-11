import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Hash from '@adonisjs/core/services/hash'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import Clinic from './clinic.js'
import Client from './client.js'
import SessionLog from './session_log.js'
import Message from './message.js'
import TreatmentGoal from './treatment_goal.js'
import Schedule from './schedule.js'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

const AuthFinder = withAuthFinder(() => Hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends AuthFinder(BaseModel) {
  static accessTokens = DbAccessTokensProvider.forModel(User)

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: 'ADMIN' | 'CLINIC' | 'BCBA' | 'RBT' | 'PARENT'

  @column()
  declare clinicId: number | null

  @column()
  declare supervisorId: number | null

  @column()
  declare hourlyRate: number | null

  @column()
  declare phone: string | null

  @column()
  declare address: string | null

  @column()
  declare isActive: boolean

  @column()
  declare verified: boolean

  // @column()
  // declare permissions: string[]

//   @column({
//   prepare: (value: string[] | null) => JSON.stringify(value || []),
//   consume: (value: string | null) => (value ? JSON.parse(value) : []),
// })
// declare permissions: string[]


@column({
  prepare: (value: string[] | null) => JSON.stringify(value || []),
  consume: (value: string | null) => {
    try {
      return value ? JSON.parse(value) : []
    } catch {
      return []
    }
  },
})
declare permissions: string[]



  @column({ serializeAs: null })
  declare rememberMeToken: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => Clinic)
  declare clinic: BelongsTo<typeof Clinic>

  @belongsTo(() => User, {
    foreignKey: 'supervisorId',
  })
  declare supervisor: BelongsTo<typeof User>

  @hasMany(() => User, {
    foreignKey: 'supervisorId',
  })
  declare supervisees: HasMany<typeof User>

  @hasMany(() => Client, {
    foreignKey: 'assignedBcba',
  })
  declare assignedClients: HasMany<typeof Client>

  @manyToMany(() => Client, {
    pivotTable: 'client_rbts',
    localKey: 'id',
    pivotForeignKey: 'rbt_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'client_id',
  })
  declare rbtClients: ManyToMany<typeof Client>

  @hasMany(() => SessionLog, {
    foreignKey: 'rbtId',
  })
  declare rbtSessions: HasMany<typeof SessionLog>

  @hasMany(() => SessionLog, {
    foreignKey: 'bcbaId',
  })
  declare bcbaSessions: HasMany<typeof SessionLog>

  @hasMany(() => Message, {
    foreignKey: 'fromUserId',
  })
  declare sentMessages: HasMany<typeof Message>

  @hasMany(() => Message, {
    foreignKey: 'toUserId',
  })
  declare receivedMessages: HasMany<typeof Message>

  @hasMany(() => TreatmentGoal, {
    foreignKey: 'createdBy',
  })
  declare createdGoals: HasMany<typeof TreatmentGoal>

  @hasMany(() => Schedule, {
    foreignKey: 'rbtId',
  })
  declare rbtSchedules: HasMany<typeof Schedule>

  @hasMany(() => Schedule, {
    foreignKey: 'bcbaId',
  })
  declare bcbaSchedules: HasMany<typeof Schedule>

  // Computed properties
  get fullName() {
    return this.name
  }

  get isAdmin() {
    return this.role === 'ADMIN'
  }

  get isClinic() {
    return this.role === 'CLINIC'
  }

  get isBCBA() {
    return this.role === 'BCBA'
  }

  get isRBT() {
    return this.role === 'RBT'
  }

  get isParent() {
    return this.role === 'PARENT'
  }
}