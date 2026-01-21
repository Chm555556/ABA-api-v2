import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'trials'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Direct session and goal relationships
      table.integer('session_id').nullable().references('id').inTable('session_logs')
      table.integer('goal_id').nullable().references('id').inTable('treatment_goals')
      
      // Enhanced trial data
      table.integer('duration_seconds').nullable()
      table.text('antecedent').nullable()
      table.text('consequence').nullable()
      table.string('prompt_type').nullable() // physical, verbal, gestural, etc.
      table.integer('prompt_level').nullable() // 0-5 independence level
      table.boolean('independent').defaultTo(false) // was response independent
      table.text('error_correction').nullable() // what correction was used
      
      // Make behavior_data_id nullable since we can record directly
      table.integer('behavior_data_id').nullable().alter()
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