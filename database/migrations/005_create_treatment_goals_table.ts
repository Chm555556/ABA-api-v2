import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'treatment_goals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE')
      table.string('title').notNullable()
      table.text('description').notNullable()
      table.string('target_behavior').notNullable()
      table.enum('measurement_type', ['frequency', 'duration', 'percentage', 'trials']).notNullable()
      table.text('mastery_criteria').notNullable()
      table.enum('status', ['active', 'mastered', 'discontinued']).defaultTo('active')
      table.integer('created_by').unsigned().notNullable().references('id').inTable('users')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}