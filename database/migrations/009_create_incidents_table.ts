import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'incidents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('session_id').unsigned().notNullable().references('id').inTable('session_logs').onDelete('CASCADE')
      table.enum('type', ['behavior', 'injury', 'property', 'other']).notNullable()
      table.enum('severity', ['low', 'medium', 'high']).notNullable()
      table.text('description').notNullable()
      table.text('action_taken').notNullable()
      table.timestamp('timestamp').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}