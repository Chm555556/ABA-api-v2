import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'parent_context_cache'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('parent_id').unsigned().notNullable().unique()
      table.json('context_data').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Foreign key constraint to users table
      table.foreign('parent_id').references('id').inTable('users').onDelete('CASCADE')

      // Index for efficient lookups
      table.index('parent_id')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
