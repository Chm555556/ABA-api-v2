import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'baseline_data'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      // Foreign key to treatment goal
      table.integer('goal_id').unsigned().references('id').inTable('treatment_goals').onDelete('CASCADE')
      
      // Baseline measurement data
      table.decimal('score', 8, 2).notNullable() // The baseline score/value
      table.integer('trials').nullable() // Number of trials (if applicable)
      table.date('collection_date').notNullable() // Date when baseline was collected
      table.text('notes').nullable() // Optional notes about the baseline collection
      
      // Metadata
      table.integer('collected_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamps(true)
      
      // Indexes
      table.index(['goal_id', 'collection_date'])
      table.index('collection_date')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}