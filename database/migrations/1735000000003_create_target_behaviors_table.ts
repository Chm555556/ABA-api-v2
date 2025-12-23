import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'target_behaviors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      
      // Foreign key to treatment goal
      table.integer('goal_id').unsigned().references('id').inTable('treatment_goals').onDelete('CASCADE')
      
      // Target behavior details
      table.string('name').notNullable() // Behavior name
      table.text('description').nullable() // Detailed description
      table.decimal('baseline_percentage', 5, 2).nullable() // Baseline percentage (0-100)
      table.enum('intensity', ['low', 'moderate', 'high', 'severe']).defaultTo('moderate')
      table.text('notes').nullable() // Additional notes
      
      // Status and tracking
      table.enum('status', ['active', 'mastered', 'discontinued', 'on_hold']).defaultTo('active')
      table.decimal('current_percentage', 5, 2).nullable() // Current performance level
      table.date('mastery_date').nullable() // Date when behavior was mastered
      
      // Metadata
      table.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL').nullable()
      table.timestamps(true)
      
      // Indexes
      table.index(['goal_id', 'status'])
      table.index('intensity')
      table.index('status')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}