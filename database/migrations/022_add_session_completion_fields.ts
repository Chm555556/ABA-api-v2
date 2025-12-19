import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add session-level feedback and progress fields
      table.text('overall_feedback').nullable()
      table.integer('overall_progress').nullable().defaultTo(0)
      table.json('client_goals_data').nullable()
      
      // Add index for better query performance
      table.index(['status', 'rbt_id'], 'idx_session_logs_status_rbt')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('overall_feedback')
      table.dropColumn('overall_progress')
      table.dropColumn('client_goals_data')
      table.dropIndex(['status', 'rbt_id'], 'idx_session_logs_status_rbt')
    })
  }
}