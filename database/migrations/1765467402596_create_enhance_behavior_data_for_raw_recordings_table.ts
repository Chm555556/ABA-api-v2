import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'behavior_data'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Add fields for enhanced behavior tracking
      table.integer('duration_seconds').nullable() // for timed behaviors
      table.integer('frequency_count').nullable() // for behavior events
      table.text('antecedent').nullable() // what happened before
      table.text('consequence').nullable() // what happened after
      table.text('environment_notes').nullable() // environmental factors
      table.decimal('baseline_value', 8, 2).nullable() // baseline comparison
      table.string('measurement_unit').nullable() // unit of measurement
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
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