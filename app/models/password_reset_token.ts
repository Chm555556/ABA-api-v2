import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class PasswordResetToken extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare token: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime()
  declare usedAt: DateTime | null

  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    return this.expiresAt < DateTime.now()
  }

  /**
   * Check if token has been used
   */
  isUsed(): boolean {
    return this.usedAt !== null
  }

  /**
   * Check if token is valid (not expired and not used)
   */
  isValid(): boolean {
    return !this.isExpired() && !this.isUsed()
  }
}
