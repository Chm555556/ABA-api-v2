import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Recurrence fields
      table.boolean('is_recurring').defaultTo(false)
      table.string('recurrence_pattern').nullable() // 'daily', 'weekly', 'biweekly', 'monthly'
      table.json('recurrence_days').nullable() // For weekly: [1,3,5] = Mon, Wed, Fri
      table.integer('recurrence_interval').nullable() // e.g., 1 for weekly, 2 for biweekly
      table.date('recurrence_end_date').nullable()
      table.integer('recurrence_count').nullable() // Number of occurrences
      table.integer('parent_session_id').unsigned().nullable().references('id').inTable('session_logs').onDelete('CASCADE')
      table.boolean('is_series_master').defaultTo(false) // True for the original recurring session
      table.integer('occurrence_number').nullable() // Which occurrence in the series (1, 2, 3...)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_recurring')
      table.dropColumn('recurrence_pattern')
      table.dropColumn('recurrence_days')
      table.dropColumn('recurrence_interval')
      table.dropColumn('recurrence_end_date')
      table.dropColumn('recurrence_count')
      table.dropColumn('parent_session_id')
      table.dropColumn('is_series_master')
      table.dropColumn('occurrence_number')
    })
  }
}
