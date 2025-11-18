import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SessionLog from './session_log.js'
import Client from './client.js'

/**
 * SessionParticipant Model
 * 
 * This model handles multiple clients in a single session.
 * Used for GROUP and COMMUNITY session types.
 * 
 * Example:
 * - One-to-One: 1 session → 1 participant
 * - Group: 1 session → multiple participants (2-5 clients)
 * - Community: 1 session → multiple participants (any number)
 */
export default class SessionParticipant extends BaseModel {
  static table = 'session_participants'
  
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'session_log_id' })
  declare sessionLogId: number

  @column({ columnName: 'client_id' })
  declare clientId: number

  @column({ columnName: 'parent_signature' })
  declare parentSignature: string | null

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => SessionLog)
  declare session: BelongsTo<typeof SessionLog>

  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  // Computed properties
  get clientName() {
    return this.client?.fullName || ''
  }
}
