import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'client_documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE')
      table.string('name').notNullable()
      table.enum('type', ['consent', 'medical', 'assessment', 'report', 'other']).notNullable()
      table.string('url').notNullable()
      table.integer('uploaded_by').unsigned().notNullable().references('id').inTable('users')
      table.timestamp('uploaded_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}