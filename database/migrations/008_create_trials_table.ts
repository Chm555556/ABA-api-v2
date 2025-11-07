import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'trials'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('behavior_data_id').unsigned().notNullable().references('id').inTable('behavior_data').onDelete('CASCADE')
      table.string('prompt').notNullable()
      table.enum('response', ['correct', 'incorrect', 'prompted', 'no_response']).notNullable()
      table.string('reinforcement').nullable()
      table.text('notes').nullable()
      table.timestamp('timestamp').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}