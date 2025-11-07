import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'goal_progress'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('progress_report_id').unsigned().notNullable().references('id').inTable('progress_reports').onDelete('CASCADE')
      table.integer('goal_id').unsigned().notNullable().references('id').inTable('treatment_goals')
      table.decimal('current_level', 5, 2).notNullable()
      table.decimal('target_level', 5, 2).notNullable()
      table.enum('progress', ['improving', 'maintaining', 'regressing']).notNullable()
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}