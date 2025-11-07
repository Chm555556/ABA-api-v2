import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'client_rbts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE')
      table.integer('rbt_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.timestamp('assigned_at').notNullable()
      table.timestamp('unassigned_at').nullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['client_id', 'rbt_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}