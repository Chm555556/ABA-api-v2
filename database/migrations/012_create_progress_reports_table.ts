import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'progress_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE')
      table.integer('generated_by').unsigned().notNullable().references('id').inTable('users')
      table.date('start_date').notNullable()
      table.date('end_date').notNullable()
      table.text('overall_summary').notNullable()
      table.text('recommendations').notNullable()
      table.json('graph_data').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}