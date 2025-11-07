import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('from_user_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('to_user_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('client_id').unsigned().nullable().references('id').inTable('clients')
      table.string('subject').notNullable()
      table.text('content').notNullable()
      table.boolean('is_read').defaultTo(false)
      table.enum('priority', ['low', 'normal', 'high']).defaultTo('normal')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}