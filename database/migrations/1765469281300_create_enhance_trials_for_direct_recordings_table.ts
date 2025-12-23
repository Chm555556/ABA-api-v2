import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'trials'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Skip adding columns that already exist
      // These columns may already exist from previous migrations
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('session_id')
      table.dropColumn('goal_id')
      table.dropColumn('duration_seconds')
      table.dropColumn('antecedent')
      table.dropColumn('consequence')
      table.dropColumn('prompt_type')
      table.dropColumn('prompt_level')
      table.dropColumn('independent')
      table.dropColumn('error_correction')
      table.integer('behavior_data_id').notNullable().alter()
    })
  }
}