import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'claims'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices')
      table.integer('client_id').unsigned().notNullable().references('id').inTable('clients')
      table.integer('rbt_id').unsigned().notNullable().references('id').inTable('users')
      table.integer('bcba_id').unsigned().notNullable().references('id').inTable('users')
      table.string('clearinghouse').notNullable()
      table.string('claim_number').notNullable()
      table.decimal('amount', 10, 2).notNullable()
      table.enum('status', ['submitted', 'accepted', 'rejected', 'paid']).defaultTo('submitted')
      table.timestamp('submitted_at').notNullable()
      table.timestamp('response_at').nullable()
      table.timestamp('paid_at').nullable()
      table.text('rejection_reason').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}