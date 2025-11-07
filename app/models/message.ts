import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Client from './client.js'

export default class Message extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fromUserId: number

  @column()
  declare toUserId: number

  @column()
  declare clientId: number | null

  @column()
  declare subject: string

  @column()
  declare content: string

  @column()
  declare isRead: boolean

  @column()
  declare priority: 'low' | 'normal' | 'high'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @belongsTo(() => User, {
    foreignKey: 'fromUserId',
  })
  declare fromUser: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'toUserId',
  })
  declare toUser: BelongsTo<typeof User>

  @belongsTo(() => Client)
  declare client: BelongsTo<typeof Client>

  // Computed properties
  get fromUserName() {
    return this.fromUser?.name || ''
  }

  get fromUserRole() {
    return this.fromUser?.role || ''
  }

  get toUserName() {
    return this.toUser?.name || ''
  }

  get toUserRole() {
    return this.toUser?.role || ''
  }

  get senderName() {
    return this.fromUserName
  }
}