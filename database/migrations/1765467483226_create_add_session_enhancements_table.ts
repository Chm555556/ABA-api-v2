import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Only add if they don't exist
      table.integer('engagement_score').nullable() // RBT subjective rating 1-5
      table.text('environment_notes').nullable() // distractions, mood, etc.
      table.boolean('offline_mode').defaultTo(false) // for offline sync
      table.timestamp('synced_at').nullable() // when synced from offline
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('engagement_score')
      table.dropColumn('environment_notes')
      table.dropColumn('offline_mode')
      table.dropColumn('synced_at')
    })
  }
}