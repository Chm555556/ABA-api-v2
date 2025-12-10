import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'treatment_goals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Domain for categorization
      table.string('domain').nullable()
      
      // Prompt hierarchy as JSON array
      table.json('prompt_hierarchy').nullable()
      
      // Baseline data
      table.decimal('baseline_score', 5, 2).nullable()
      table.integer('baseline_trials').nullable()
      
      // Mastery criteria
      table.integer('target_percentage').nullable()
      table.integer('consecutive_sessions').nullable()
      
      // Goal phase
      table.enum('goal_phase', ['acquisition', 'maintenance', 'mastered', 'discontinued']).defaultTo('acquisition')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('domain')
      table.dropColumn('prompt_hierarchy')
      table.dropColumn('baseline_score')
      table.dropColumn('baseline_trials')
      table.dropColumn('target_percentage')
      table.dropColumn('consecutive_sessions')
      table.dropColumn('goal_phase')
    })
  }
}
