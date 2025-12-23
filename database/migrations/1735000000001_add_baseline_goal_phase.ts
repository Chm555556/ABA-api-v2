import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'treatment_goals'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Update the goal_phase enum to include 'baseline'
      table.dropColumn('goal_phase')
    })
    
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('goal_phase', ['baseline', 'acquisition', 'maintenance', 'mastered', 'discontinued']).defaultTo('baseline')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('goal_phase')
    })
    
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('goal_phase', ['acquisition', 'maintenance', 'mastered', 'discontinued']).defaultTo('acquisition')
    })
  }
}