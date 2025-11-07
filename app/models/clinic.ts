import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Client from './client.js'

export default class Clinic extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

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
  declare npiNumber: string | null

  @column()
  declare taxId: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @hasMany(() => User)
  declare users: HasMany<typeof User>

  @hasMany(() => Client)
  declare clients: HasMany<typeof Client>

  // Computed properties
  get address() {
    return {
      street: this.street,
      city: this.city,
      state: this.state,
      zipCode: this.zipCode,
    }
  }

  get fullAddress() {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}`
  }
}