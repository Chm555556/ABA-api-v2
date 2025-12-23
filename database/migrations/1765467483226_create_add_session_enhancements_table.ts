import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Skip adding columns that already exist
      // These columns may already exist from previous migrations
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