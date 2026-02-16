import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class ParentContextCache extends BaseModel {
  static table = 'parent_context_cache'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare parentId: number

  @column({
    prepare: (value: any) => {
      if (typeof value === 'string') return value
      return JSON.stringify(value)
    },
    consume: (value: any) => {
      if (!value) return null
      if (typeof value === 'object') return value
      try {
        return JSON.parse(value)
      } catch (error) {
        console.error('Failed to parse context_data:', error)
        return null
      }
    },
  })
  declare contextData: any

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relationships
  @belongsTo(() => User, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof User>
}
