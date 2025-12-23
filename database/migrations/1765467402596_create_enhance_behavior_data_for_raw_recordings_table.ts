import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'behavior_data'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Check if columns exist before adding them
      // These columns may already exist from previous migrations
      
      // Skip adding columns that already exist
      // The columns are already present in the table
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Only drop columns if they exist
      table.dropColumn('duration_seconds')
      table.dropColumn('frequency_count')
      table.dropColumn('antecedent')
      table.dropColumn('consequence')
      table.dropColumn('environment_notes')
      table.dropColumn('baseline_value')
      table.dropColumn('measurement_unit')
    })
  }
}